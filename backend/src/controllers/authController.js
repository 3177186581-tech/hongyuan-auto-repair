const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { success, error, asyncHandler } = require('../utils');
const { JWT_SECRET } = require('../middleware/auth');

const authController = {
  // 登录
  login: asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.json(error('请输入用户名和密码'));
    }
    
    const [users] = await pool.execute(
      'SELECT id, username, password, real_name, role, status, avatar FROM users WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      return res.json(error('用户名或密码错误'));
    }
    
    const user = users[0];
    
    if (user.status === 0) {
      return res.json(error('账号已被禁用，请联系管理员'));
    }
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.json(error('用户名或密码错误'));
    }
    
    // 更新最后登录时间
    await pool.execute('UPDATE users SET last_login_time = NOW() WHERE id = ?', [user.id]);
    
    // 生成Token
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    delete user.password;
    res.json(success({ token, user }));
  }),
  
  // 获取当前用户信息
  getProfile: asyncHandler(async (req, res) => {
    const [users] = await pool.execute(
      'SELECT id, username, real_name, phone, role, avatar, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(success(users[0]));
  }),
  
  // 修改密码
  changePassword: asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword || newPassword.length < 6) {
      return res.json(error('请输入正确的旧密码和新密码(至少6位)'));
    }
    
    const [users] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(oldPassword, users[0].password);
    
    if (!match) {
      return res.json(error('旧密码错误'));
    }
    
    const hashedPwd = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPwd, req.user.id]);
    
    res.json(success(null, '密码修改成功，请重新登录'));
  }),
  
  // 创建员工账号(管理员)
  createUser: asyncHandler(async (req, res) => {
    const { username, password, real_name, phone, role } = req.body;
    
    if (!username || !password || !real_name) {
      return res.json(error('请填写完整信息'));
    }
    
    const hashedPwd = await bcrypt.hash(password, 10);
    
    try {
      const [result] = await pool.execute(
        'INSERT INTO users (username, password, real_name, phone, role) VALUES (?, ?, ?, ?, ?)',
        [username, hashedPwd, real_name, phone, role || 'reception']
      );
      res.json(success({ id: result.insertId }, '创建成功'));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.json(error('用户名已存在'));
      }
      throw err;
    }
  }),
  
  // 获取员工列表
  getUsers: asyncHandler(async (req, res) => {
    const [users] = await pool.execute(
      'SELECT id, username, real_name, phone, role, status, last_login_time, created_at FROM users WHERE is_deleted = 0 ORDER BY created_at DESC'
    );
    res.json(success(users));
  })
};

module.exports = authController;
