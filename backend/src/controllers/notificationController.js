const pool = require('../config/database');
const { success, error, getPageParams, asyncHandler } = require('../utils');

const notificationController = {
  // 获取通知列表
  list: asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = getPageParams(req);
    const { receiver_id, receiver_type, is_read, type } = req.query;
    
    let where = 'WHERE 1=1';
    const params = [];
    
    if (receiver_id) {
      where += ' AND receiver_id = ?';
      params.push(receiver_id);
    }
    if (receiver_type) {
      where += ' AND receiver_type = ?';
      params.push(receiver_type);
    }
    if (is_read !== undefined) {
      where += ' AND is_read = ?';
      params.push(is_read);
    }
    if (type) {
      where += ' AND type = ?';
      params.push(type);
    }
    
    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM notifications ${where}`, params
    );
    
    const [rows] = await pool.execute(
      `SELECT * FROM notifications ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    
    res.json(success({
      list: rows,
      total: totalRows[0].total,
      page, pageSize
    }));
  }),
  
  // 标记已读
  markRead: asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    res.json(success(null, '已标记已读'));
  }),
  
  // 全部标记已读
  markAllRead: asyncHandler(async (req, res) => {
    const { receiver_id, receiver_type } = req.body;
    await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE receiver_id = ? AND receiver_type = ? AND is_read = 0',
      [receiver_id, receiver_type]
    );
    res.json(success(null, '全部已读'));
  }),
  
  // 创建通知(内部调用)
  create: asyncHandler(async (req, res) => {
    const { receiver_id, receiver_type, type, title, content, related_id } = req.body;
    
    await pool.execute(
      `INSERT INTO notifications (receiver_id, receiver_type, type, title, content, related_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [receiver_id, receiver_type, type, title, content, related_id]
    );
    
    res.json(success(null, '通知已发送'));
  }),
  
  // 未读计数
  unreadCount: asyncHandler(async (req, res) => {
    const { receiver_id, receiver_type } = req.query;
    
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE receiver_id = ? AND receiver_type = ? AND is_read = 0',
      [receiver_id, receiver_type]
    );
    
    res.json(success({ count: rows[0].count }));
  })
};

module.exports = notificationController;
