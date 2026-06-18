const pool = require('../config/database');
const { success, error, asyncHandler } = require('../utils');

const hardwareController = {
  // 设备列表
  list: asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      'SELECT * FROM hardware_devices ORDER BY created_at DESC'
    );
    res.json(success(rows));
  }),
  
  // 注册设备
  register: asyncHandler(async (req, res) => {
    const { name, type, brand, model, serial_number, ip_address, port, config } = req.body;
    
    if (!name || !type) {
      return res.json(error('设备名称和类型为必填项'));
    }
    
    const [result] = await pool.execute(
      `INSERT INTO hardware_devices (name, type, brand, model, serial_number, ip_address, port, config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, type, brand, model, serial_number, ip_address, port, config ? JSON.stringify(config) : null]
    );
    
    res.json(success({ id: result.insertId }, '设备注册成功'));
  }),
  
  // 更新设备状态(心跳)
  heartbeat: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    await pool.execute(
      'UPDATE hardware_devices SET status = ?, last_heartbeat = NOW() WHERE id = ?',
      [status || 'online', id]
    );
    
    res.json(success(null, '心跳更新成功'));
  }),
  
  // 设备控制指令
  sendCommand: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { command, params } = req.body;
    
    // 这里集成具体的硬件通信协议
    // 如: 举升机控制、诊断电脑数据获取、小票打印机
    console.log(`设备${id} 指令: ${command}`, params);
    
    // 模拟响应
    res.json(success({
      device_id: id,
      command,
      status: 'executed',
      timestamp: new Date().toISOString()
    }));
  }),
  
  // 打印小票
  printReceipt: asyncHandler(async (req, res) => {
    const { order_id } = req.body;
    
    // 获取工单信息
    const [orders] = await pool.execute(
      `SELECT ro.*, c.name as customer_name, v.plate_number
       FROM repair_orders ro
       LEFT JOIN customers c ON ro.customer_id = c.id
       LEFT JOIN vehicles v ON ro.vehicle_id = v.id
       WHERE ro.id = ?`, [order_id]
    );
    
    if (orders.length === 0) {
      return res.json(error('工单不存在'));
    }
    
    // 获取工单项目
    const [items] = await pool.execute(
      'SELECT * FROM repair_items WHERE order_id = ?', [order_id]
    );
    
    // 生成打印数据
    const receipt = {
      shop_name: '宏源汽车服务',
      order_no: orders[0].order_no,
      customer: orders[0].customer_name,
      plate: orders[0].plate_number,
      items: items,
      total: orders[0].total_amount,
      payment_method: orders[0].payment_method,
      time: new Date().toLocaleString(),
      qrcode_url: 'https://your-domain.com/order/' + order_id
    };
    
    console.log('打印小票数据:', JSON.stringify(receipt, null, 2));
    
    res.json(success(receipt, '打印指令已发送'));
  })
};

module.exports = hardwareController;
