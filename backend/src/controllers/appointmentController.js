const pool = require('../config/database');
const { success, error, getPageParams, asyncHandler } = require('../utils');

const appointmentController = {
  // 预约列表
  list: asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = getPageParams(req);
    const { status, start_date, end_date } = req.query;
    
    let where = '';
    const params = [];
    
    if (status) {
      where += ' AND a.status = ?';
      params.push(status);
    }
    if (start_date) {
      where += ' AND DATE(a.appointment_time) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      where += ' AND DATE(a.appointment_time) <= ?';
      params.push(end_date);
    }
    
    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM appointments a WHERE 1=1 ${where}`, params
    );
    
    const [rows] = await pool.execute(
      `SELECT a.*, c.name as customer_name, c.phone as customer_phone,
       v.plate_number, v.brand, v.model
       FROM appointments a
       LEFT JOIN customers c ON a.customer_id = c.id
       LEFT JOIN vehicles v ON a.vehicle_id = v.id
       WHERE 1=1 ${where}
       ORDER BY a.appointment_time ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    
    res.json(success({
      list: rows,
      total: totalRows[0].total,
      page, pageSize
    }));
  }),
  
  // 创建预约
  create: asyncHandler(async (req, res) => {
    const {
      customer_id, vehicle_id, customer_name, customer_phone, plate_number,
      service_type, appointment_time, estimated_duration, customer_remark, source
    } = req.body;
    
    if (!service_type || !appointment_time) {
      return res.json(error('服务类型和预约时间为必填项'));
    }
    
    const [result] = await pool.execute(
      `INSERT INTO appointments
       (customer_id, vehicle_id, customer_name, customer_phone, plate_number,
        service_type, appointment_time, estimated_duration, customer_remark, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, vehicle_id, customer_name, customer_phone, plate_number,
       service_type, appointment_time, estimated_duration || 60, customer_remark, source || 'miniprogram']
    );
    
    res.json(success({ id: result.insertId }, '预约创建成功'));
  }),
  
  // 确认预约
  confirm: asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.execute(
      'UPDATE appointments SET status = "confirmed" WHERE id = ?', [id]
    );
    res.json(success(null, '预约已确认'));
  }),
  
  // 到店(转为工单)
  arrive: asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // 获取预约信息
    const [appointments] = await pool.execute('SELECT * FROM appointments WHERE id = ?', [id]);
    if (appointments.length === 0) return res.json(error('预约不存在'));
    
    const appt = appointments[0];
    
    // 生成工单编号
    const { generateOrderNo } = require('../utils');
    const orderNo = await generateOrderNo();
    
    // 创建工单
    const [result] = await pool.execute(
      `INSERT INTO repair_orders
       (order_no, customer_id, vehicle_id, receptionist_id, type, customer_complaint, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [orderNo, appt.customer_id, appt.vehicle_id, req.user.id, appt.service_type, appt.customer_remark]
    );
    
    // 更新预约状态
    await pool.execute('UPDATE appointments SET status = "arrived", order_id = ? WHERE id = ?', [result.insertId, id]);
    
    res.json(success({ order_id: result.insertId, order_no: orderNo }, '已创建工单'));
  }),
  
  // 取消预约
  cancel: asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.execute('UPDATE appointments SET status = "cancelled" WHERE id = ?', [id]);
    res.json(success(null, '预约已取消'));
  })
};

module.exports = appointmentController;
