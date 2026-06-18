const pool = require('../config/database');
const { success, error, getPageParams, asyncHandler } = require('../utils');

const vehicleController = {
  // 车辆列表
  list: asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = getPageParams(req);
    const { keyword, customer_id } = req.query;
    
    let where = 'WHERE v.is_deleted = 0';
    const params = [];
    
    if (keyword) {
      where += ' AND (v.plate_number LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (customer_id) {
      where += ' AND v.customer_id = ?';
      params.push(customer_id);
    }
    
    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM vehicles v ${where}`, params
    );
    
    const [rows] = await pool.execute(
      `SELECT v.*, c.name as customer_name, c.phone as customer_phone
       FROM vehicles v
       LEFT JOIN customers c ON v.customer_id = c.id
       ${where}
       ORDER BY v.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    
    res.json(success({
      list: rows,
      total: totalRows[0].total,
      page, pageSize
    }));
  }),
  
  // 创建车辆
  create: asyncHandler(async (req, res) => {
    const {
      customer_id, plate_number, vin, brand, model, year, color,
      engine_type, transmission, mileage, fuel_type,
      insurance_company, insurance_expire, inspection_expire
    } = req.body;
    
    if (!customer_id || !plate_number) {
      return res.json(error('客户ID和车牌号为必填项'));
    }
    
    try {
      const [result] = await pool.execute(
        `INSERT INTO vehicles
         (customer_id, plate_number, vin, brand, model, year, color, engine_type, transmission, mileage, fuel_type, insurance_company, insurance_expire, inspection_expire)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [customer_id, plate_number, vin, brand, model, year, color, engine_type, transmission, mileage || 0, fuel_type, insurance_company, insurance_expire, inspection_expire]
      );
      res.json(success({ id: result.insertId }, '车辆添加成功'));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.json(error('车牌号已存在'));
      }
      throw err;
    }
  }),
  
  // 更新车辆
  update: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    
    const allowedFields = ['plate_number','vin','brand','model','year','color','engine_type','transmission','mileage','fuel_type','insurance_company','insurance_expire','inspection_expire','remark','status'];
    const sets = [];
    const values = [];
    
    for (const [k, v] of Object.entries(fields)) {
      if (allowedFields.includes(k) && v !== undefined) {
        sets.push(`${k} = ?`);
        values.push(v);
      }
    }
    
    if (sets.length === 0) {
      return res.json(error('没有可更新的字段'));
    }
    
    values.push(id);
    await pool.execute(`UPDATE vehicles SET ${sets.join(', ')} WHERE id = ?`, values);
    res.json(success(null, '更新成功'));
  }),
  
  // 删除车辆
  remove: asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.execute('UPDATE vehicles SET is_deleted = 1 WHERE id = ?', [id]);
    res.json(success(null, '删除成功'));
  })
};

module.exports = vehicleController;
