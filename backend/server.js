const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'hongyuan-auto-secret-2024';

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 确保上传目录存在
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// MySQL 连接池
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'hongyuan_auto_repair',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// JWT 中间件
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ code: 401, msg: '未登录' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).json({ code: 401, msg: 'Token无效' });
    }
}

// ==================== 认证接口 ====================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE username = ? AND password = ?',
            [username, password]
        );
        if (rows.length === 0) {
            return res.json({ code: 400, msg: '用户名或密码错误' });
        }
        const user = rows[0];
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ code: 200, msg: '登录成功', data: { token, user: { id: user.id, username: user.username, name: user.name, role: user.role } } });
    } catch (err) {
        res.json({ code: 500, msg: '服务器错误' });
    }
});

// ==================== 客户管理 ====================
app.get('/api/customers', authMiddleware, async (req, res) => {
    const { keyword, page = 1, pageSize = 20 } = req.query;
    let sql = 'SELECT * FROM customers WHERE 1=1';
    let params = [];
    if (keyword) {
        sql += ' AND (name LIKE ? OR phone LIKE ? OR plate_number LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    try {
        const [rows] = await pool.query(sql, params);
        const [total] = await pool.query('SELECT COUNT(*) as count FROM customers');
        res.json({ code: 200, data: { list: rows, total: total[0].count } });
    } catch (err) {
        res.json({ code: 500, msg: '查询失败' });
    }
});

app.post('/api/customers', authMiddleware, async (req, res) => {
    const { name, phone, plate_number, car_brand, car_model, car_year, vin, mileage } = req.body;
    try {
        await pool.query(
            'INSERT INTO customers (name, phone, plate_number, car_brand, car_model, car_year, vin, mileage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, phone, plate_number, car_brand, car_model, car_year, vin, mileage || 0]
        );
        res.json({ code: 200, msg: '添加成功' });
    } catch (err) {
        res.json({ code: 500, msg: '添加失败' });
    }
});

app.put('/api/customers/:id', authMiddleware, async (req, res) => {
    const { name, phone, plate_number, car_brand, car_model, car_year, vin, mileage } = req.body;
    try {
        await pool.query(
            'UPDATE customers SET name=?, phone=?, plate_number=?, car_brand=?, car_model=?, car_year=?, vin=?, mileage=? WHERE id=?',
            [name, phone, plate_number, car_brand, car_model, car_year, vin, mileage, req.params.id]
        );
        res.json({ code: 200, msg: '更新成功' });
    } catch (err) {
        res.json({ code: 500, msg: '更新失败' });
    }
});

app.delete('/api/customers/:id', authMiddleware, async (req, res) => {
    try {
        await pool.query('DELETE FROM customers WHERE id=?', [req.params.id]);
        res.json({ code: 200, msg: '删除成功' });
    } catch (err) {
        res.json({ code: 500, msg: '删除失败' });
    }
});

// ==================== 维修工单 ====================
app.get('/api/orders', authMiddleware, async (req, res) => {
    const { status, keyword, page = 1, pageSize = 20 } = req.query;
    let sql = `SELECT o.*, c.name as customer_name, c.phone, c.plate_number, c.car_brand, c.car_model 
               FROM repair_orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE 1=1`;
    let params = [];
    if (status) { sql += ' AND o.status = ?'; params.push(status); }
    if (keyword) { sql += ' AND (c.name LIKE ? OR c.plate_number LIKE ? OR o.order_no LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    try {
        const [rows] = await pool.query(sql, params);
        const [total] = await pool.query('SELECT COUNT(*) as count FROM repair_orders');
        res.json({ code: 200, data: { list: rows, total: total[0].count } });
    } catch (err) {
        res.json({ code: 500, msg: '查询失败' });
    }
});

app.post('/api/orders', authMiddleware, async (req, res) => {
    const { customer_id, items, labor_fee, total_amount, remark, mileage } = req.body;
    const order_no = 'HY' + Date.now();
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            'INSERT INTO repair_orders (order_no, customer_id, labor_fee, total_amount, remark, mileage, status) VALUES (?, ?, ?, ?, ?, ?, "pending")',
            [order_no, customer_id, labor_fee, total_amount, remark, mileage]
        );
        const orderId = conn.lastInsertId;
        for (const item of items) {
            await conn.query(
                'INSERT INTO order_items (order_id, type, name, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?)',
                [orderId, item.type, item.name, item.quantity, item.unit_price, item.amount]
            );
            // 减少库存
            if (item.type === 'part') {
                await conn.query('UPDATE inventory SET quantity = quantity - ? WHERE name = ?', [item.quantity, item.name]);
            }
        }
        await conn.commit();
        res.json({ code: 200, msg: '开单成功', data: { order_no } });
    } catch (err) {
        await conn.rollback();
        res.json({ code: 500, msg: '开单失败: ' + err.message });
    } finally {
        conn.release();
    }
});

app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
    const { status } = req.body;
    try {
        await pool.query('UPDATE repair_orders SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ code: 200, msg: '状态更新成功' });
    } catch (err) {
        res.json({ code: 500, msg: '更新失败' });
    }
});

// ==================== 配件库存 ====================
app.get('/api/inventory', authMiddleware, async (req, res) => {
    const { keyword, category, page = 1, pageSize = 20 } = req.query;
    let sql = 'SELECT * FROM inventory WHERE 1=1';
    let params = [];
    if (keyword) { sql += ' AND (name LIKE ? OR code LIKE ? OR brand LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    try {
        const [rows] = await pool.query(sql, params);
        const [total] = await pool.query('SELECT COUNT(*) as count FROM inventory');
        // 标记低库存
        rows.forEach(r => r.stock_status = r.quantity <= r.min_quantity ? 'low' : 'normal');
        res.json({ code: 200, data: { list: rows, total: total[0].count } });
    } catch (err) {
        res.json({ code: 500, msg: '查询失败' });
    }
});

app.post('/api/inventory', authMiddleware, async (req, res) => {
    const { code, name, category, brand, spec, unit, quantity, min_quantity, cost_price, sell_price, supplier } = req.body;
    try {
        await pool.query(
            'INSERT INTO inventory (code, name, category, brand, spec, unit, quantity, min_quantity, cost_price, sell_price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [code, name, category, brand, spec, unit, quantity, min_quantity, cost_price, sell_price, supplier]
        );
        res.json({ code: 200, msg: '添加成功' });
    } catch (err) {
        res.json({ code: 500, msg: '添加失败' });
    }
});

app.put('/api/inventory/:id', authMiddleware, async (req, res) => {
    const { code, name, category, brand, spec, unit, quantity, min_quantity, cost_price, sell_price, supplier } = req.body;
    try {
        await pool.query(
            'UPDATE inventory SET code=?, name=?, category=?, brand=?, spec=?, unit=?, quantity=?, min_quantity=?, cost_price=?, sell_price=?, supplier=? WHERE id=?',
            [code, name, category, brand, spec, unit, quantity, min_quantity, cost_price, sell_price, supplier, req.params.id]
        );
        res.json({ code: 200, msg: '更新成功' });
    } catch (err) {
        res.json({ code: 500, msg: '更新失败' });
    }
});

app.post('/api/inventory/in', authMiddleware, async (req, res) => {
    const { id, quantity, remark } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [quantity, id]);
        await conn.query(
            'INSERT INTO inventory_logs (inventory_id, type, quantity, remark, operator) VALUES (?, "in", ?, ?, ?)',
            [id, quantity, remark, req.user.username]
        );
        await conn.commit();
        res.json({ code: 200, msg: '入库成功' });
    } catch (err) {
        await conn.rollback();
        res.json({ code: 500, msg: '入库失败' });
    } finally {
        conn.release();
    }
});

// ==================== 收银结算 ====================
app.post('/api/payments', authMiddleware, async (req, res) => {
    const { order_id, amount, method, remark } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            'INSERT INTO payments (order_id, amount, method, remark) VALUES (?, ?, ?, ?)',
            [order_id, amount, method, remark]
        );
        // 更新订单状态为已结算
        await conn.query('UPDATE repair_orders SET status = "completed" WHERE id = ?', [order_id]);
        await conn.commit();
        res.json({ code: 200, msg: '结算成功' });
    } catch (err) {
        await conn.rollback();
        res.json({ code: 500, msg: '结算失败' });
    } finally {
        conn.release();
    }
});

app.get('/api/payments', authMiddleware, async (req, res) => {
    const { start_date, end_date, page = 1, pageSize = 20 } = req.query;
    let sql = `SELECT p.*, o.order_no, c.name as customer_name 
               FROM payments p LEFT JOIN repair_orders o ON p.order_id = o.id 
               LEFT JOIN customers c ON o.customer_id = c.id WHERE 1=1`;
    let params = [];
    if (start_date) { sql += ' AND DATE(p.created_at) >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND DATE(p.created_at) <= ?'; params.push(end_date); }
    sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    try {
        const [rows] = await pool.query(sql, params);
        res.json({ code: 200, data: rows });
    } catch (err) {
        res.json({ code: 500, msg: '查询失败' });
    }
});

// ==================== 数据统计 ====================
app.get('/api/stats/daily', authMiddleware, async (req, res) => {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    try {
        const [revenue] = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(created_at) = ?',
            [targetDate]
        );
        const [orders] = await pool.query(
            'SELECT COUNT(*) as count FROM repair_orders WHERE DATE(created_at) = ?',
            [targetDate]
        );
        const [orderStats] = await pool.query(
            `SELECT status, COUNT(*) as count FROM repair_orders WHERE DATE(created_at) = ? GROUP BY status`,
            [targetDate]
        );
        const [items] = await pool.query(
            `SELECT oi.name, SUM(oi.quantity) as total_qty, SUM(oi.amount) as total_amount 
             FROM order_items oi LEFT JOIN repair_orders ro ON oi.order_id = ro.id 
             WHERE DATE(ro.created_at) = ? GROUP BY oi.name ORDER BY total_amount DESC LIMIT 10`,
            [targetDate]
        );
        res.json({
            code: 200,
            data: {
                date: targetDate,
                revenue: revenue[0].total,
                order_count: orders[0].count,
                status_stats: orderStats,
                top_items: items
            }
        });
    } catch (err) {
        res.json({ code: 500, msg: '统计失败' });
    }
});

app.get('/api/stats/monthly', authMiddleware, async (req, res) => {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    try {
        const [revenue] = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE_FORMAT(created_at, "%Y-%m") = ?',
            [targetMonth]
        );
        const [orders] = await pool.query(
            'SELECT COUNT(*) as count FROM repair_orders WHERE DATE_FORMAT(created_at, "%Y-%m") = ?',
            [targetMonth]
        );
        const [daily] = await pool.query(
            `SELECT DATE(created_at) as day, COALESCE(SUM(amount), 0) as revenue 
             FROM payments WHERE DATE_FORMAT(created_at, "%Y-%m") = ? 
             GROUP BY DATE(created_at) ORDER BY day`,
            [targetMonth]
        );
        res.json({
            code: 200,
            data: {
                month: targetMonth,
                revenue: revenue[0].total,
                order_count: orders[0].count,
                daily_revenue: daily
            }
        });
    } catch (err) {
        res.json({ code: 500, msg: '统计失败' });
    }
});

// ==================== 员工管理 ====================
app.get('/api/employees', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE role != "admin" ORDER BY created_at DESC');
        res.json({ code: 200, data: rows });
    } catch (err) {
        res.json({ code: 500, msg: '查询失败' });
    }
});

app.post('/api/employees', authMiddleware, async (req, res) => {
    const { username, password, name, role, phone } = req.body;
    try {
        await pool.query(
            'INSERT INTO users (username, password, name, role, phone) VALUES (?, ?, ?, ?, ?)',
            [username, password, name, role, phone]
        );
        res.json({ code: 200, msg: '添加成功' });
    } catch (err) {
        res.json({ code: 500, msg: '添加失败' });
    }
});

// ==================== 消息提醒 ====================
app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
        // 低库存提醒
        const [lowStock] = await pool.query('SELECT * FROM inventory WHERE quantity <= min_quantity');
        // 保养到期提醒（里程数超过上次保养+5000）
        const [maintenance] = await pool.query(
            'SELECT * FROM customers WHERE mileage > 0 AND mileage % 5000 >= 4000'
        );
        res.json({
            code: 200,
            data: {
                low_stock: lowStock,
                maintenance_due: maintenance,
                low_stock_count: lowStock.length,
                maintenance_count: maintenance.length
            }
        });
    } catch (err) {
        res.json({ code: 500, msg: '查询失败' });
    }
});

// ==================== 硬件对接 ====================
// 小票打印机接口
app.post('/api/hardware/print-receipt', authMiddleware, async (req, res) => {
    const { order_id } = req.body;
    try {
        const [order] = await pool.query(
            `SELECT o.*, c.name as customer_name, c.phone, c.plate_number 
             FROM repair_orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = ?`,
            [order_id]
        );
        const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order_id]);
        
        // 生成ESC/POS指令（小票打印机通用协议）
        const receipt = generateReceipt(order[0], items);
        
        // 实际项目中这里通过WebSocket或串口发送给打印机
        // 这里模拟返回打印内容
        res.json({
            code: 200,
            msg: '打印指令已发送',
            data: { receipt_content: receipt, order_no: order[0].order_no }
        });
    } catch (err) {
        res.json({ code: 500, msg: '打印失败' });
    }
});

function generateReceipt(order, items) {
    let text = '\n';
    text += '====== 宏源汽车服务 ======\n';
    text += `订单号: ${order.order_no}\n`;
    text += `客户: ${order.customer_name}\n`;
    text += `车牌: ${order.plate_number}\n`;
    text += `电话: ${order.phone}\n`;
    text += '--------------------------\n';
    items.forEach(item => {
        text += `${item.name} x${item.quantity}\n`;
        text += `  ¥${item.unit_price} = ¥${item.amount}\n`;
    });
    text += '--------------------------\n';
    text += `工时费: ¥${order.labor_fee}\n`;
    text += `合计: ¥${order.total_amount}\n`;
    text += '==========================\n';
    text += '  感谢光临，欢迎下次再来！\n';
    text += '  电话: 022-XXXX-XXXX\n';
    text += '\n\n\n';
    return text;
}

// 举升机状态接口
app.get('/api/hardware/lift-status', authMiddleware, async (req, res) => {
    // 模拟举升机状态，实际项目中对接IoT设备
    res.json({
        code: 200,
        data: {
            lift_1: { status: 'idle', last_used: null },
            lift_2: { status: 'in_use', current_order: 'HY001', started_at: new Date().toISOString() }
        }
    });
});

// ==================== 小程序端接口 ====================
// 小程序登录
app.post('/api/wx/login', async (req, res) => {
    const { code, user_info } = req.body;
    // 实际项目中用code换openid，这里简化
    const openid = 'wx_' + Date.now();
    try {
        let [rows] = await pool.query('SELECT * FROM wx_users WHERE openid = ?', [openid]);
        if (rows.length === 0) {
            await pool.query(
                'INSERT INTO wx_users (openid, nickname, avatar) VALUES (?, ?, ?)',
                [openid, user_info?.nickName, user_info?.avatarUrl]
            );
        }
        const token = jwt.sign({ openid, type: 'wx' }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ code: 200, data: { token, openid } });
    } catch (err) {
        res.json({ code: 500, msg: '登录失败' });
    }
});

// 小程序：查询工单进度
app.get('/api/wx/orders/:orderNo', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT o.*, c.name as customer_name, c.plate_number 
             FROM repair_orders o LEFT JOIN customers c ON o.customer_id = c.id 
             WHERE o.order_no = ?`,
            [req.params.orderNo]
        );
        if (rows.length === 0) return res.json({ code: 404, msg: '工单不存在' });
        const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [rows[0].id]);
        res.json({ code: 200, data: { ...rows[0], items } });
    } catch (err) {
        res.json({ code: 500, msg: '查询失败' });
    }
});

// 小程序：在线预约
app.post('/api/wx/appointments', async (req, res) => {
    const { openid, service_type, plate_number, appointment_time, remark } = req.body;
    try {
        await pool.query(
            'INSERT INTO appointments (openid, service_type, plate_number, appointment_time, remark) VALUES (?, ?, ?, ?, ?)',
            [openid, service_type, plate_number, appointment_time, remark]
        );
        res.json({ code: 200, msg: '预约成功' });
    } catch (err) {
        res.json({ code: 500, msg: '预约失败' });
    }
});

// 小程序：保养记录
app.get('/api/wx/maintenance-records', async (req, res) => {
    const { openid } = req.query;
    try {
        const [rows] = await pool.query(
            `SELECT ro.*, c.plate_number, c.car_brand, c.car_model 
             FROM repair_orders ro LEFT JOIN customers c ON ro.customer_id = c.id 
             WHERE c.phone IN (SELECT phone FROM wx_users WHERE openid = ?) 
             ORDER BY ro.created_at DESC`,
            [openid]
        );
        res.json({ code: 200, data: rows });
    } catch (err) {
        res.json({ code: 500, msg: '查询失败' });
    }
});

// ==================== 启动服务器 ====================
app.listen(PORT, () => {
    console.log(`宏源汽车服务管理系统 后端服务已启动！`);
    console.log(`API地址: http://localhost:${PORT}/api`);
    console.log(`管理后台: http://localhost:${PORT}`);
});
