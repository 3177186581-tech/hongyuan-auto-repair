const pool = require('../config/database');
const { success, error, asyncHandler, dayjs } = require('../utils');

const reportController = {
  // 营业日报
  dailyReport: asyncHandler(async (req, res) => {
    const { date } = req.query;
    const targetDate = date || dayjs().format('YYYY-MM-DD');
    
    const [orders] = await pool.execute(
      `SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'completed' THEN labor_cost ELSE 0 END) as labor_revenue,
        SUM(CASE WHEN status = 'completed' THEN parts_cost ELSE 0 END) as parts_revenue,
        AVG(CASE WHEN status = 'completed' THEN total_amount ELSE NULL END) as avg_order_value
       FROM repair_orders
       WHERE DATE(created_at) = ? AND is_deleted = 0`,
      [targetDate]
    );
    
    const [newCustomers] = await pool.execute(
      'SELECT COUNT(*) as count FROM customers WHERE DATE(created_at) = ? AND is_deleted = 0',
      [targetDate]
    );
    
    const [appointments] = await pool.execute(
      'SELECT COUNT(*) as count FROM appointments WHERE DATE(created_at) = ?',
      [targetDate]
    );
    
    // 按类型统计
    const [typeStats] = await pool.execute(
      `SELECT type, COUNT(*) as count, SUM(total_amount) as revenue
       FROM repair_orders
       WHERE DATE(created_at) = ? AND status = 'completed' AND is_deleted = 0
       GROUP BY type`,
      [targetDate]
    );
    
    // 按支付方式统计
    const [payStats] = await pool.execute(
      `SELECT payment_method, COUNT(*) as count, SUM(total_amount) as revenue
       FROM repair_orders
       WHERE DATE(created_at) = ? AND status = 'completed' AND is_deleted = 0
       GROUP BY payment_method`,
      [targetDate]
    );
    
    res.json(success({
      date: targetDate,
      summary: orders[0],
      new_customers: newCustomers[0].count,
      appointments: appointments[0].count,
      type_stats: typeStats,
      payment_stats: payStats
    }));
  }),
  
  // 月度统计
  monthlyReport: asyncHandler(async (req, res) => {
    const { year, month } = req.query;
    const y = year || dayjs().year();
    const m = month || dayjs().month() + 1;
    const start = `${y}-${String(m).padStart(2,'0')}-01`;
    const end = dayjs(start).add(1, 'month').format('YYYY-MM-DD');
    
    const [orders] = await pool.execute(
      `SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'completed' THEN labor_cost ELSE 0 END) as labor_revenue,
        SUM(CASE WHEN status = 'completed' THEN parts_cost ELSE 0 END) as parts_revenue
       FROM repair_orders
       WHERE DATE(created_at) >= ? AND DATE(created_at) < ? AND is_deleted = 0`,
      [start, end]
    );
    
    // 日趋势
    const [dailyTrend] = await pool.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as orders, SUM(total_amount) as revenue
       FROM repair_orders
       WHERE DATE(created_at) >= ? AND DATE(created_at) < ? AND status = 'completed' AND is_deleted = 0
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [start, end]
    );
    
    res.json(success({
      period: `${y}年${m}月`,
      summary: orders[0],
      daily_trend: dailyTrend
    }));
  }),
  
  // 客户来源统计
  customerStats: asyncHandler(async (req, res) => {
    const [sourceStats] = await pool.execute(
      `SELECT source, COUNT(*) as count
       FROM customers
       WHERE is_deleted = 0
       GROUP BY source`
    );
    
    const [memberStats] = await pool.execute(
      `SELECT member_level, COUNT(*) as count
       FROM customers
       WHERE is_deleted = 0
       GROUP BY member_level`
    );
    
    const [topCustomers] = await pool.execute(
      `SELECT c.name, c.phone, COUNT(ro.id) as order_count, SUM(ro.total_amount) as total_spent
       FROM customers c
       LEFT JOIN repair_orders ro ON c.id = ro.customer_id AND ro.is_deleted = 0
       WHERE c.is_deleted = 0
       GROUP BY c.id
       ORDER BY total_spent DESC
       LIMIT 10`
    );
    
    res.json(success({
      source_stats: sourceStats,
      member_stats: memberStats,
      top_customers: topCustomers
    }));
  })
};

module.exports = reportController;
