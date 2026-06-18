const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');

// 生成工单编号: HY + 年月日 + 4位序号
async function generateOrderNo() {
  const today = dayjs().format('YYYYMMDD');
  const prefix = `HY${today}`;
  
  const [rows] = await pool.execute(
    'SELECT order_no FROM repair_orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1',
    [`${prefix}%`]
  );
  
  let seq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].order_no;
    seq = parseInt(lastNo.substring(lastNo.length - 4)) + 1;
  }
  
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// 统一响应格式
function success(data = null, msg = '操作成功') {
  return { code: 0, msg, data };
}

function error(msg = '操作失败', code = 1) {
  return { code, msg, data: null };
}

// 分页参数处理
function getPageParams(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

// 异步路由包装
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 计算下次保养日期/里程
function calcNextMaintenance(lastDate, lastMileage, monthInterval = 6, mileageInterval = 5000) {
  const nextDate = lastDate ? dayjs(lastDate).add(monthInterval, 'month').format('YYYY-MM-DD') : null;
  const nextMileage = lastMileage ? lastMileage + mileageInterval : null;
  return { nextDate, nextMileage };
}

module.exports = {
  generateOrderNo,
  success,
  error,
  getPageParams,
  asyncHandler,
  calcNextMaintenance,
  dayjs,
  uuidv4
};
