-- 宏源汽车服务管理系统 数据库初始化脚本
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS hongyuan_auto_repair CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hongyuan_auto_repair;

-- 1. 用户表（员工/管理员）
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL COMMENT '登录账号',
    password VARCHAR(255) NOT NULL COMMENT '密码',
    name VARCHAR(50) NOT NULL COMMENT '姓名',
    role ENUM('admin', 'manager', 'technician', 'reception') DEFAULT 'technician' COMMENT '角色',
    phone VARCHAR(20) COMMENT '手机号',
    avatar VARCHAR(255) COMMENT '头像',
    status TINYINT DEFAULT 1 COMMENT '1=启用 0=禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='员工用户表';

-- 2. 客户表
CREATE TABLE customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '客户姓名',
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    plate_number VARCHAR(20) COMMENT '车牌号',
    car_brand VARCHAR(50) COMMENT '车辆品牌',
    car_model VARCHAR(50) COMMENT '车辆型号',
    car_year VARCHAR(10) COMMENT '年款',
    vin VARCHAR(50) COMMENT '车架号',
    mileage INT DEFAULT 0 COMMENT '当前里程(km)',
    address VARCHAR(255) COMMENT '地址',
    remark TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_plate (plate_number)
) ENGINE=InnoDB COMMENT='客户及车辆信息表';

-- 3. 配件库存表
CREATE TABLE inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE COMMENT '配件编码',
    name VARCHAR(200) NOT NULL COMMENT '配件名称',
    category ENUM('tire', 'battery', 'chassis', 'brake', 'engine', 'oil', 'filter', 'other') NOT NULL COMMENT '类别',
    brand VARCHAR(50) COMMENT '品牌',
    spec VARCHAR(100) COMMENT '规格型号',
    unit VARCHAR(20) DEFAULT '个' COMMENT '单位',
    quantity INT DEFAULT 0 COMMENT '当前库存',
    min_quantity INT DEFAULT 5 COMMENT '最低库存预警值',
    cost_price DECIMAL(10,2) COMMENT '成本价',
    sell_price DECIMAL(10,2) COMMENT '销售价',
    supplier VARCHAR(100) COMMENT '供应商',
    location VARCHAR(50) COMMENT '库位',
    status TINYINT DEFAULT 1 COMMENT '1=正常 0=停用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_name (name)
) ENGINE=InnoDB COMMENT='配件库存表';

-- 4. 库存操作日志
CREATE TABLE inventory_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inventory_id INT NOT NULL,
    type ENUM('in', 'out', 'adjust') NOT NULL COMMENT '入库/出库/调整',
    quantity INT NOT NULL COMMENT '数量',
    remark VARCHAR(255) COMMENT '备注',
    operator VARCHAR(50) COMMENT '操作人',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='库存操作日志';

-- 5. 维修工单表
CREATE TABLE repair_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_no VARCHAR(50) UNIQUE NOT NULL COMMENT '工单编号',
    customer_id INT NOT NULL COMMENT '客户ID',
    technician_id INT COMMENT '技师ID',
    lift_no VARCHAR(10) COMMENT '举升机编号',
    mileage INT COMMENT '当前里程',
    labor_fee DECIMAL(10,2) DEFAULT 0 COMMENT '工时费',
    total_amount DECIMAL(10,2) DEFAULT 0 COMMENT '总金额',
    status ENUM('pending', 'in_progress', 'waiting_parts', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '状态',
    remark TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB COMMENT='维修工单表';

-- 6. 工单明细表
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    type ENUM('part', 'labor', 'service') NOT NULL COMMENT '配件/工时/服务',
    name VARCHAR(200) NOT NULL COMMENT '项目名称',
    quantity INT DEFAULT 1 COMMENT '数量',
    unit_price DECIMAL(10,2) NOT NULL COMMENT '单价',
    amount DECIMAL(10,2) NOT NULL COMMENT '金额',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES repair_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='工单明细表';

-- 7. 支付记录表
CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL COMMENT '支付金额',
    method ENUM('cash', 'wechat', 'alipay', 'bank_card', 'credit') NOT NULL COMMENT '支付方式',
    remark VARCHAR(255) COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES repair_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='支付记录表';

-- 8. 预约表
CREATE TABLE appointments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    openid VARCHAR(100) COMMENT '微信openid',
    service_type VARCHAR(100) NOT NULL COMMENT '服务类型',
    plate_number VARCHAR(20) COMMENT '车牌号',
    appointment_time DATETIME NOT NULL COMMENT '预约时间',
    remark TEXT COMMENT '备注',
    status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_appointment (appointment_time)
) ENGINE=InnoDB COMMENT='客户预约表';

-- 9. 小程序用户表
CREATE TABLE wx_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    openid VARCHAR(100) UNIQUE NOT NULL,
    nickname VARCHAR(100) COMMENT '昵称',
    avatar VARCHAR(255) COMMENT '头像',
    phone VARCHAR(20) COMMENT '绑定手机号',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='微信小程序用户表';

-- 10. 消息通知表
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type ENUM('low_stock', 'maintenance_due', 'new_order', 'appointment') NOT NULL COMMENT '通知类型',
    title VARCHAR(200) NOT NULL COMMENT '标题',
    content TEXT COMMENT '内容',
    is_read TINYINT DEFAULT 0 COMMENT '0=未读 1=已读',
    target_user INT COMMENT '目标用户ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_unread (is_read, target_user)
) ENGINE=InnoDB COMMENT='消息通知表';

-- ==================== 初始数据 ====================

-- 默认管理员账号 (用户名: admin, 密码: admin123)
INSERT INTO users (username, password, name, role) VALUES ('admin', 'admin123', '管理员', 'admin');

-- 示例员工
INSERT INTO users (username, password, name, role, phone) VALUES 
('tech1', '123456', '张师傅', 'technician', '13800000001'),
('tech2', '123456', '李师傅', 'technician', '13800000002'),
('reception1', '123456', '小王', 'reception', '13800000003');

-- 示例客户
INSERT INTO customers (name, phone, plate_number, car_brand, car_model, car_year, mileage) VALUES
('张先生', '13900000001', '津A·88888', '大众', '朗逸', '2020', 35000),
('李女士', '13900000002', '津B·66666', '丰田', '卡罗拉', '2021', 28000),
('王老板', '13900000003', '津C·99999', '本田', '雅阁', '2019', 52000),
('赵先生', '13900000004', '津D·77777', '别克', '英朗', '2022', 15000);

-- 示例库存
INSERT INTO inventory (code, name, category, brand, spec, unit, quantity, min_quantity, cost_price, sell_price, supplier) VALUES
('TY-001', '205/55R16 91V 米其林浩悦', 'tire', '米其林', '205/55R16', '条', 12, 4, 480, 680, '天津米其林总代'),
('TY-002', '195/65R15 91H 普利司通', 'tire', '普利司通', '195/65R15', '条', 8, 4, 320, 480, '天津普利司通代理'),
('BP-001', '瓦尔塔 60Ah 电瓶', 'battery', '瓦尔塔', 'L2-400', '个', 6, 2, 280, 450, '天津瓦尔塔总代'),
('BP-002', '风帆 55Ah 电瓶', 'battery', '风帆', '6-QW-55', '个', 5, 2, 200, 350, '天津风帆代理'),
('CK-001', '博世 前刹车片', 'brake', '博世', '0986T1', '套', 10, 3, 120, 220, '博世天津代理'),
('CK-002', '博世 空气滤芯', 'filter', '博世', '0986AF', '个', 15, 5, 25, 55, '博世天津代理'),
('CK-003', '美孚1号 5W-30 4L', 'oil', '美孚', '5W-30', '桶', 20, 5, 180, 320, '美孚天津总代'),
('CK-004', '嘉实多 极护 5W-40 4L', 'oil', '嘉实多', '5W-40', '桶', 18, 5, 160, 290, '嘉实多天津代理'),
('DP-001', '下摆臂（左）', 'chassis', 'TRW', 'JTC1001', '个', 4, 2, 150, 320, 'TRW天津代理'),
('DP-002', '前减震器', 'chassis', 'KYB', '3390001', '支', 4, 2, 280, 520, 'KYB天津代理');

-- 示例工单
INSERT INTO repair_orders (order_no, customer_id, technician_id, mileage, labor_fee, total_amount, status, remark) VALUES
('HY202501010001', 1, 1, 35000, 80, 760, 'completed', '更换机油机滤 + 左前轮胎'),
('HY202501010002', 2, 2, 28000, 120, 870, 'completed', '四轮定位 + 更换前刹车片'),
('HY202501020001', 3, 1, 52000, 200, 1420, 'in_progress', '大保养：机油+三滤+火花塞+电瓶');

-- 示例工单明细
INSERT INTO order_items (order_id, type, name, quantity, unit_price, amount) VALUES
(1, 'part', '美孚1号 5W-30 4L', 1, 320, 320),
(1, 'part', '机油滤芯', 1, 35, 35),
(1, 'part', '205/55R16 米其林', 1, 680, 680),
(1, 'labor', '换油工时', 1, 80, 80),
(2, 'part', '博世前刹车片', 1, 220, 220),
(2, 'labor', '四轮定位', 1, 120, 120),
(2, 'labor', '更换刹车片', 1, 80, 80),
(2, 'part', '四轮定位调整', 1, 150, 150);

-- 示例支付
INSERT INTO payments (order_id, amount, method, remark) VALUES
(1, 760, 'wechat', '微信扫码支付'),
(2, 870, 'alipay', '支付宝付款');

-- 示例预约
INSERT INTO appointments (service_type, plate_number, appointment_time, remark, status) VALUES
('小保养（换油+机滤）', '津E·12345', DATE_ADD(NOW(), INTERVAL 1 DAY), '客户要求上午10点前', 'pending'),
('轮胎更换', '津F·67890', DATE_ADD(NOW(), INTERVAL 2 DAY), '前轮两个轮胎磨损严重', 'confirmed');

-- 示例通知
INSERT INTO notifications (type, title, content, target_user) VALUES
('low_stock', '库存预警', '米其林 205/55R16 库存仅剩2条，请及时补货！', 1),
('maintenance_due', '保养到期提醒', '客户张先生(津A·88888) 里程已达35000km，建议提醒保养', 1),
('new_order', '新工单', '工单 HY202501020001 已创建，等待接单', 2);

-- ==================== 存储过程 ====================

-- 每日营收统计
DELIMITER $$
CREATE PROCEDURE sp_daily_revenue(IN target_date DATE)
BEGIN
    SELECT 
        COUNT(DISTINCT p.order_id) as paid_orders,
        SUM(p.amount) as total_revenue,
        COUNT(DISTINCT ro.customer_id) as unique_customers,
        AVG(p.amount) as avg_order_value
    FROM payments p
    LEFT JOIN repair_orders ro ON p.order_id = ro.id
    WHERE DATE(p.created_at) = target_date;
END$$
DELIMITER ;

-- 配件销量排行
DELIMITER $$
CREATE PROCEDURE sp_part_sales_rank(IN start_date DATE, IN end_date DATE)
BEGIN
    SELECT 
        oi.name,
        SUM(oi.quantity) as total_qty,
        SUM(oi.amount) as total_revenue,
        COUNT(DISTINCT oi.order_id) as order_count
    FROM order_items oi
    LEFT JOIN repair_orders ro ON oi.order_id = ro.id
    WHERE DATE(ro.created_at) BETWEEN start_date AND end_date
    AND oi.type = 'part'
    GROUP BY oi.name
    ORDER BY total_revenue DESC
    LIMIT 20;
END$$
DELIMITER ;

-- ==================== 触发器 ====================

-- 库存低于最低值时自动创建通知
DELIMITER $$
CREATE TRIGGER trg_low_stock_notify
AFTER UPDATE ON inventory
FOR EACH ROW
BEGIN
    IF NEW.quantity <= NEW.min_quantity AND OLD.quantity > OLD.min_quantity THEN
        INSERT INTO notifications (type, title, content) 
        VALUES ('low_stock', CONCAT('库存预警: ', NEW.name), 
                CONCAT('当前库存: ', NEW.quantity, '，最低库存: ', NEW.min_quantity, '，请及时补货！'));
    END IF;
END$$
DELIMITER ;

-- ==================== 视图 ====================

-- 工单详情视图
CREATE VIEW v_order_detail AS
SELECT 
    ro.order_no,
    ro.status,
    ro.total_amount,
    ro.created_at,
    c.name as customer_name,
    c.phone,
    c.plate_number,
    c.car_brand,
    c.car_model,
    u.name as technician_name
FROM repair_orders ro
LEFT JOIN customers c ON ro.customer_id = c.id
LEFT JOIN users u ON ro.technician_id = u.id;

-- 库存概览视图
CREATE VIEW v_inventory_overview AS
SELECT 
    i.*,
    CASE 
        WHEN i.quantity <= i.min_quantity THEN 'urgent'
        WHEN i.quantity <= i.min_quantity * 2 THEN 'warning'
        ELSE 'normal'
    END as stock_level,
    (i.quantity * i.sell_price) as stock_value
FROM inventory i
WHERE i.status = 1;
