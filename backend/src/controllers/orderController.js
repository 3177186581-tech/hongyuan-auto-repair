const pool = require('../config/database');
const { success, error, getPageParams, generateOrderNo, asyncHandler } = require('../utils');

const orderController = {
  // 工单列表
  list: asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = getPageParams(req);
    const { keyword, status, type, start_date, end_date } = req.query;
    
    let where = 'WHERE ro.is_deleted = 0';
    const params = [];
    
    if (keyword) {
      where += ' AND (ro.order_no LIKE ? OR c.name LIKE ? OR v.plate_number LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (status) {
      where += ' AND ro.status = ?';
      params.push(status);
    }
    if (type) {
      where += ' AND ro.type = ?';
      params.push(type);
    }
    if (start_date) {
      where += ' AND DATE(ro.created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      where += ' AND DATE(ro.created_at) <= ?';
      params.push(end_date);
    }
    
    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM repair_orders ro
       LEFT JOIN customers c ON ro.customer_id = c.id
       LEFT JOIN vehicles v ON ro.vehicle_id = v.id
       ${where}`, params
    );
    
    const [rows] = await pool.execute(
      `SELECT ro.*, c.name as customer_name, c.phone as customer_phone,
       v.plate_number, v.brand, v.model,
       u1.real_name as receptionist_name, u2.real_name as technician_name
       FROM repair_orders ro
       LEFT JOIN customers c ON ro.customer_id = c.id
       LEFT JOIN vehicles v ON ro.vehicle_id = v.id
       LEFT JOIN users u1 ON ro.receptionist_id = u1.id
       LEFT JOIN users u2 ON ro.technician_id = u2.id
       ${where}
       ORDER BY ro.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    
    res.json(success({
      list: rows,
      total: totalRows[0].total,
      page, pageSize
    }));
  }),
  
  // 工单详情
  detail: asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const [orders] = await pool.execute(
      `SELECT ro.*, c.name as customer_name, c.phone as customer_phone,
       v.plate_number, v.brand, v.model, v.year, v.color, v.mileage as vehicle_mileage,
       u1.real_name as receptionist_name, u2.real_name as technician_name
       FROM repair_orders ro
       LEFT JOIN customers c ON ro.customer_id = c.id
       LEFT JOIN vehicles v ON ro.vehicle_id = v.id
       LEFT JOIN users u1 ON ro.receptionist_id = u1.id
       LEFT JOIN users u2 ON ro.technician_id = u2.id
       WHERE ro.id = ? AND ro.is_deleted = 0`, [id]
    );
    
    if (orders.length === 0) {
      return res.json(error('工单不存在'));
    }
    
    // 获取工单项目
    const [items] = await pool.execute(
      'SELECT * FROM repair_items WHERE order_id = ? ORDER BY sort_order', [id]
    );
    
    // 获取进度时间线
    const [timeline] = await pool.execute(
      `SELECT ot.*, u.real_name as operator_name
       FROM order_timeline ot
       LEFT JOIN users u ON ot.operator_id = u.id
       WHERE ot.order_id = ?
       ORDER BY ot.created_at`, [id]
    );
    
    res.json(success({
      order: orders[0],
      items,
      timeline
    }));
  }),
  
  // 创建工单
  create: asyncHandler(async (req, res) => {
    const {
      customer_id, vehicle_id, type, priority, appointment_time,
      customer_complaint, mileage, fuel_level, vehicle_appearance,
      customer_items, technician_id
    } = req.body;
    
    if (!customer_id || !vehicle_id || !type) {
      return res.json(error('客户、车辆和服务类型为必填项'));
    }
    
    const orderNo = await generateOrderNo();
    
    const [result] = await pool.execute(
      `INSERT INTO repair_orders
       (order_no, customer_id, vehicle_id, receptionist_id, technician_id, type, priority,
        appointment_time, customer_complaint, mileage, fuel_level, vehicle_appearance,
        customer_items, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [orderNo, customer_id, vehicle_id, req.user.id, technician_id || null, type,
       priority || 'normal', appointment_time, customer_complaint, mileage, fuel_level,
       JSON.stringify(vehicle_appearance || {}), JSON.stringify(customer_items || {})
      ]
    );
    
    // 添加时间线记录
    await pool.execute(
      'INSERT INTO order_timeline (order_id, status, description, operator_id) VALUES (?, ?, ?, ?)',
      [result.insertId, 'pending', '工单创建', req.user.id]
    );
    
    res.json(success({ id: result.insertId, order_no: orderNo }, '工单创建成功'));
  }),
  
  // 更新工单状态
  updateStatus: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, diagnosis_result, solution, estimated_finish_time } = req.body;
    
    const updates = ['status = ?'];
    const values = [status];
    
    if (diagnosis_result) {
      updates.push('diagnosis_result = ?');
      values.push(diagnosis_result);
    }
    if (solution) {
      updates.push('solution = ?');
      values.push(solution);
    }
    if (estimated_finish_time) {
      updates.push('estimated_finish_time = ?');
      values.push(estimated_finish_time);
    }
    
    // 根据状态设置时间字段
    if (status === 'repairing') {
      updates.push('start_time = IFNULL(start_time, NOW())');
    }
    if (status === 'completed') {
      updates.push('actual_finish_time = NOW()');
    }
    
    values.push(id);
    await pool.execute(`UPDATE repair_orders SET ${updates.join(', ')} WHERE id = ?`, values);
    
    // 添加时间线
    const statusMap = {
      'diagnosing': '开始诊断', 'repairing': '开始维修', 'waiting_parts': '等待配件',
      'quality_check': '质检中', 'completed': '维修完成', 'cancelled': '已取消'
    };
    await pool.execute(
      'INSERT INTO order_timeline (order_id, status, description, operator_id) VALUES (?, ?, ?, ?)',
      [id, status, statusMap[status] || status, req.user.id]
    );
    
    res.json(success(null, '状态更新成功'));
  }),
  
  // 添加工单项目
  addItem: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { type, name, part_id, quantity, unit_price, technician, remark } = req.body;
    
    if (!type || !name || !unit_price) {
      return res.json(error('请填写完整项目信息'));
    }
    
    const total_price = parseFloat(unit_price) * parseInt(quantity || 1);
    
    const [result] = await pool.execute(
      `INSERT INTO repair_items (order_id, type, name, part_id, quantity, unit_price, total_price, technician, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, type, name, part_id || null, quantity || 1, unit_price, total_price, technician, remark]
    );
    
    // 更新工单总价
    await recalcOrderTotal(id);
    
    // 如果是配件，减少库存
    if (type === 'part' && part_id) {
      await pool.execute(
        'UPDATE parts SET stock_quantity = stock_quantity - ? WHERE id = ?', [quantity || 1, part_id]
      );
      // 记录库存变动
      await pool.execute(
        `INSERT INTO stock_logs (part_id, type, quantity, before_quantity, after_quantity, order_id, operator_id, remark)
         SELECT ?, 'out', ?, stock_quantity + ?, stock_quantity, ?, ?, '工单出库'
         FROM parts WHERE id = ?`,
        [part_id, -(quantity || 1), (quantity || 1), id, req.user.id, part_id]
      );
    }
    
    res.json(success({ id: result.insertId }, '项目添加成功'));
  }),
  
  // 结算工单
  settle: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { payment_method, discount_amount, other_fee } = req.body;
    
    await pool.execute(
      `UPDATE repair_orders
       SET payment_method = ?, discount_amount = ?, other_fee = ?, payment_status = 'paid',
           paid_amount = total_amount, status = 'completed', actual_finish_time = NOW()
       WHERE id = ?`,
      [payment_method, discount_amount || 0, other_fee || 0, id]
    );
    
    // 更新客户累计消费
    const [orders] = await pool.execute('SELECT customer_id, total_amount FROM repair_orders WHERE id = ?', [id]);
    if (orders.length > 0) {
      await pool.execute(
        'UPDATE customers SET total_spent = total_spent + ? WHERE id = ?',
        [orders[0].total_amount, orders[0].customer_id]
      );
    }
    
    res.json(success(null, '结算成功'));
  })
};

// 重新计算工单总价
async function recalcOrderTotal(orderId) {
  const [items] = await pool.execute(
    'SELECT SUM(total_price) as parts_cost FROM repair_items WHERE order_id = ? AND type = "part"', [orderId]
  );
  const [laborItems] = await pool.execute(
    'SELECT SUM(total_price) as labor_cost FROM repair_items WHERE order_id = ? AND type = "labor"', [orderId]
  );
  const [otherItems] = await pool.execute(
    'SELECT SUM(total_price) as other_cost FROM repair_items WHERE order_id = ? AND type = "other"', [orderId]
  );
  
  const labor_cost = laborItems[0].labor_cost || 0;
  const parts_cost = items[0].parts_cost || 0;
  const other_cost = otherItems[0].other_cost || 0;
  const total = parseFloat(labor_cost) + parseFloat(parts_cost) + parseFloat(other_cost);
  
  await pool.execute(
    'UPDATE repair_orders SET labor_cost = ?, parts_cost = ?, total_amount = ? WHERE id = ?',
    [labor_cost, parts_cost, total, orderId]
  );
}

module.exports = orderController;
