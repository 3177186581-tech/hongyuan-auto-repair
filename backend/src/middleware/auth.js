const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { error } = require('../utils');

const JWT_SECRET = process.env.JWT_SECRET || 'hongyuan_auto_repair_secret_key_2026';

// 验证Token中间件
async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.json(error('请先登录', 401));
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const [users] = await pool.execute(
      'SELECT id, username, real_name, role, status FROM users WHERE id = ? AND status = 1',
      [decoded.userId]
    );
    
    if (users.length === 0) {
      return res.json(error('账号已被禁用', 403));
    }
    
    req.user = users[0];
    next();
  } catch (err) {
    return res.json(error('登录已过期，请重新登录', 401));
  }
}

// 角色权限中间件
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.json(error('权限不足', 403));
    }
    next();
  };
}

module.exports = { authenticate, requireRole, JWT_SECRET };
