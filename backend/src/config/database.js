const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hongyuan_auto_repair',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// 测试连接
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL数据库连接成功!');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL数据库连接失败:', err.message);
  });

module.exports = pool;
