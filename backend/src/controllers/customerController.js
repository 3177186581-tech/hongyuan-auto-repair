const pool = require('../config/database');
const { success, error, getPageParams, asyncHandler } = require('../utils');

const customerController = {
  // 客户列表(分页+搜索)
  list: asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = getPageParams(req);
    const { keyword, member_level, source } = req.query;
    
    let where = 'WHERE c.is_deleted = 0';
    const params = [];
    
    if (keyword) {
      where += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (member_level) {
      where += ' AND c.member_level = ?';
      params.push(member_level);
    }
    if (source) {
      where += ' AND c.source = ?';
      params.push(source);
    }
    
    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM customers c ${where}`, params
    );
    
    const [rows] = await pool.execute(
      `SELECT c.*, COUNT(DISTINCT v.id) as vehicle_count, COUNT(DISTINCT ro.id) as order_count,
       MAX(ro.created_at) as last_visit
       FROM customers c
       LEFT JOIN vehicles v ON c.id = v.customer_id AND v.is_deleted = 0
       LEFT JOIN repair_orders ro ON c.id = ro.customer_id AND ro.is_deleted = 0
       ${where}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    
    res.json(success({
      list: rows,
      total: totalRows[0].total,
      page, pageSize
    }));
  }),
  
  // 客户详情
  detail: asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const [customers] = await pool.execute(
      'SELECT * FROM customers WHERE id = ? AND is_deleted = 0', [id]
    );
    if (customers.length === 0) {
      return res.json(error('客户不存在'));
    }
    
    // 车辆列表
    const [vehicles] = await pool.execute(
      'SELECT * FROM vehicles WHERE customer_id = ? AND is_deleted = 0 ORDER BY created_at DESC', [id]
    );
    
    // 工单历史
    const [orders] = await pool.execute(
      `SELECT ro.*, v.plate_number, v.brand, v.model
       FROM repair_orders ro
       LEFT JOIN vehicles v ON ro.vehicle_id = v.id
       WHERE ro.customer_id = ? AND ro.is_deleted = 0
       ORDER BY ro.created_at DESC LIMIT 50`, [id]
    );
    
    res.json(success({
      customer: customers[0],
      vehicles,
      orders
    }));
  }),
  
  // 创建客户
  create: asyncHandler(async (req, res) => {
    const { name, phone, gender, birthday, address, source, remark } = req.body;
    
    if (!name || !phone) {
      return res.json(error('姓名和手机号为必填项'));
    }
    
    try {
      const [result] = await pool.execute(
        `INSERT INTO customers (name, phone, gender, birthday, address, source, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, phone, gender, birthday, address, source || 'walk_in', remark]
      );
      res.json(success({ id: result.insertId }, '客户创建成功'));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.json(error('手机号已存在'));
      }
      throw err;
    }
  }),
  
  // 更新客户
  update: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, phone, gender, birthday, address, member_level, remark } = req.body;
    
    await pool.execute(
      `UPDATE customers SET name=?, phone=?, gender=?, birthday=?, address=?, member_level=?, remark=? WHERE id=? AND is_deleted=0`,
      [name, phone, gender, birthday, address, member_level, remark, id]
    );
    res.json(success(null, '更新成功'));
  }),
  
  // 删除客户(软删除)
  remove: asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.execute('UPDATE customers SET is_deleted = 1 WHERE id = ?', [id]);
    res.json(success(null, '删除成功'));
  })
};

module.exports = customerController;
