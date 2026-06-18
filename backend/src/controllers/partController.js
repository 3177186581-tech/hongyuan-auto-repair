const pool = require('../config/database');
const { success, error, getPageParams, asyncHandler } = require('../utils');

const partController = {
  // 配件列表
  list: asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = getPageParams(req);
    const { keyword, category, brand, low_stock } = req.query;
    
    let where = 'WHERE p.is_deleted = 0';
    const params = [];
    
    if (keyword) {
      where += ' AND (p.name LIKE ? OR p.code LIKE ? OR p.specification LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (category) {
      where += ' AND p.category = ?';
      params.push(category);
    }
    if (brand) {
      where += ' AND p.brand LIKE ?';
      params.push(`%${brand}%`);
    }
    if (low_stock === 'true') {
      where += ' AND p.stock_quantity <= p.min_stock';
    }
    
    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM parts p ${where}`, params
    );
    
    const [rows] = await pool.execute(
      `SELECT p.*, s.name as supplier_name
       FROM parts p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ${where}
       ORDER BY p.stock_quantity ASC, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    
    res.json(success({
      list: rows,
      total: totalRows[0].total,
      page, pageSize
    }));
  }),
  
  // 创建配件
  create: asyncHandler(async (req, res) => {
    const {
      code, name, category, brand, specification, unit, purchase_price,
      sell_price, stock_quantity, min_stock, supplier_id, compatible_vehicles
    } = req.body;
    
    if (!code || !name || !category) {
      return res.json(error('编码、名称和分类为必填项'));
    }
    
    try {
      const [result] = await pool.execute(
        `INSERT INTO parts
         (code, name, category, brand, specification, unit, purchase_price, sell_price,
          stock_quantity, min_stock, supplier_id, compatible_vehicles)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, name, category, brand, specification, unit || '个', purchase_price || 0,
         sell_price || 0, stock_quantity || 0, min_stock || 5, supplier_id,
         compatible_vehicles ? JSON.stringify(compatible_vehicles) : null]
      );
      res.json(success({ id: result.insertId }, '配件添加成功'));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.json(error('配件编码已存在'));
      }
      throw err;
    }
  }),
  
  // 更新配件
  update: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    
    const allowedFields = ['code','name','category','brand','specification','unit','purchase_price','sell_price','stock_quantity','min_stock','supplier_id','status'];
    const sets = [];
    const values = [];
    
    for (const [k, v] of Object.entries(fields)) {
      if (allowedFields.includes(k) && v !== undefined) {
        sets.push(`${k} = ?`);
        values.push(v);
      }
    }
    
    if (sets.length === 0) return res.json(error('没有可更新的字段'));
    values.push(id);
    await pool.execute(`UPDATE parts SET ${sets.join(', ')} WHERE id = ?`, values);
    res.json(success(null, '更新成功'));
  }),
  
  // 入库(采购入库/退货入库)
  stockIn: asyncHandler(async (req, res) => {
    const { part_id, quantity, purchase_id, remark } = req.body;
    
    if (!part_id || !quantity) {
      return res.json(error('请填写完整信息'));
    }
    
    // 获取当前库存
    const [parts] = await pool.execute('SELECT stock_quantity FROM parts WHERE id = ?', [part_id]);
    if (parts.length === 0) return res.json(error('配件不存在'));
    
    const beforeQty = parts[0].stock_quantity;
    const afterQty = beforeQty + parseInt(quantity);
    
    // 更新库存
    await pool.execute('UPDATE parts SET stock_quantity = ? WHERE id = ?', [afterQty, part_id]);
    
    // 记录变动
    await pool.execute(
      `INSERT INTO stock_logs (part_id, type, quantity, before_quantity, after_quantity, purchase_id, operator_id, remark)
       VALUES (?, 'in', ?, ?, ?, ?, ?, ?)`,
      [part_id, quantity, beforeQty, afterQty, purchase_id, req.user.id, remark]
    );
    
    res.json(success(null, '入库成功'));
  }),
  
  // 库存变动记录
  stockLogs: asyncHandler(async (req, res) => {
    const { part_id } = req.query;
    let where = '';
    const params = [];
    
    if (part_id) {
      where = 'WHERE sl.part_id = ?';
      params.push(part_id);
    }
    
    const [rows] = await pool.execute(
      `SELECT sl.*, p.name as part_name, p.code as part_code, u.real_name as operator_name
       FROM stock_logs sl
       LEFT JOIN parts p ON sl.part_id = p.id
       LEFT JOIN users u ON sl.operator_id = u.id
       ${where}
       ORDER BY sl.created_at DESC
       LIMIT 100`, params
    );
    
    res.json(success(rows));
  }),
  
  // 供应商列表
  getSuppliers: asyncHandler(async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM suppliers WHERE status = 1 ORDER BY name');
    res.json(success(rows));
  })
};

module.exports = partController;
