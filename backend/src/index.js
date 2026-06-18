const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authController = require('./controllers/authController');
const customerController = require('./controllers/customerController');
const vehicleController = require('./controllers/vehicleController');
const orderController = require('./controllers/orderController');
const partController = require('./controllers/partController');
const appointmentController = require('./controllers/appointmentController');
const reportController = require('./controllers/reportController');
const notificationController = require('./controllers/notificationController');
const hardwareController = require('./controllers/hardwareController');
const { authenticate, requireRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleString()} ${req.method} ${req.path}`);
  next();
});

// ============ 认证路由(无需鉴权) ============
app.post('/api/auth/login', authController.login);

// ============ 需要鉴权的路由 ============
app.use('/api', authenticate);

// 用户/员工
app.get('/api/auth/profile', authController.getProfile);
app.post('/api/auth/change-password', authController.changePassword);
app.post('/api/users', requireRole('admin', 'manager'), authController.createUser);
app.get('/api/users', requireRole('admin', 'manager'), authController.getUsers);

// 客户
app.get('/api/customers', customerController.list);
app.get('/api/customers/:id', customerController.detail);
app.post('/api/customers', customerController.create);
app.put('/api/customers/:id', customerController.update);
app.delete('/api/customers/:id', requireRole('admin', 'manager'), customerController.remove);

// 车辆
app.get('/api/vehicles', vehicleController.list);
app.post('/api/vehicles', vehicleController.create);
app.put('/api/vehicles/:id', vehicleController.update);
app.delete('/api/vehicles/:id', vehicleController.remove);

// 工单
app.get('/api/orders', orderController.list);
app.get('/api/orders/:id', orderController.detail);
app.post('/api/orders', orderController.create);
app.put('/api/orders/:id/status', orderController.updateStatus);
app.post('/api/orders/:id/items', orderController.addItem);
app.post('/api/orders/:id/settle', orderController.settle);

// 配件/库存
app.get('/api/parts', partController.list);
app.post('/api/parts', requireRole('admin', 'manager', 'reception'), partController.create);
app.put('/api/parts/:id', requireRole('admin', 'manager', 'reception'), partController.update);
app.post('/api/parts/stock-in', requireRole('admin', 'manager', 'reception'), partController.stockIn);
app.get('/api/parts/stock-logs', partController.stockLogs);
app.get('/api/suppliers', partController.getSuppliers);

// 预约
app.get('/api/appointments', appointmentController.list);
app.post('/api/appointments', appointmentController.create);
app.post('/api/appointments/:id/confirm', appointmentController.confirm);
app.post('/api/appointments/:id/arrive', appointmentController.arrive);
app.post('/api/appointments/:id/cancel', appointmentController.cancel);

// 报表统计
app.get('/api/reports/daily', reportController.dailyReport);
app.get('/api/reports/monthly', reportController.monthlyReport);
app.get('/api/reports/customer-stats', reportController.customerStats);

// 通知
app.get('/api/notifications', notificationController.list);
app.post('/api/notifications', requireRole('admin', 'manager'), notificationController.create);
app.post('/api/notifications/:id/read', notificationController.markRead);
app.post('/api/notifications/read-all', notificationController.markAllRead);
app.get('/api/notifications/unread-count', notificationController.unreadCount);

// 硬件设备
app.get('/api/hardware', requireRole('admin', 'manager'), hardwareController.list);
app.post('/api/hardware', requireRole('admin'), hardwareController.register);
app.post('/api/hardware/:id/heartbeat', hardwareController.heartbeat);
app.post('/api/hardware/:id/command', requireRole('admin', 'manager', 'technician'), hardwareController.sendCommand);
app.post('/api/hardware/print-receipt', hardwareController.printReceipt);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 0, msg: '服务正常', time: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ code: 404, msg: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err);
  res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 宏源汽车服务管理系统 后端服务已启动!`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🌐 接口地址: http://localhost:${PORT}/api`);
});

module.exports = app;
