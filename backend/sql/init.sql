-- 宏源汽车服务管理系统 - 数据库初始化脚本
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS `hongyuan_auto_repair` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `hongyuan_auto_repair`;

-- ============================================
-- 1. 员工/用户表
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
  `username` VARCHAR(50) UNIQUE NOT NULL COMMENT '登录账号',
  `password` VARCHAR(255) NOT NULL COMMENT '密码(BCrypt加密)',
  `real_name` VARCHAR(50) NOT NULL COMMENT '真实姓名',
  `phone` VARCHAR(20) COMMENT '手机号',
  `role` ENUM('admin','manager','technician','reception','finance') NOT NULL DEFAULT 'reception' COMMENT '角色',
  `avatar` VARCHAR(255) COMMENT '头像URL',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1启用 0禁用',
  `last_login_time` DATETIME COMMENT '最后登录时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (`username`),
  INDEX idx_role (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户/员工表';

-- ============================================
-- 2. 客户表
-- ============================================
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '客户ID',
  `name` VARCHAR(100) NOT NULL COMMENT '客户姓名',
  `phone` VARCHAR(20) UNIQUE NOT NULL COMMENT '手机号',
  `gender` ENUM('male','female','other') DEFAULT 'male' COMMENT '性别',
  `birthday` DATE COMMENT '生日(用于提醒)',
  `address` VARCHAR(255) COMMENT '地址',
  `wechat_openid` VARCHAR(100) UNIQUE COMMENT '微信OpenID(小程序)',
  `member_level` ENUM('normal','silver','gold','diamond') DEFAULT 'normal' COMMENT '会员等级',
  `total_spent` DECIMAL(10,2) DEFAULT 0.00 COMMENT '累计消费金额',
  `balance` DECIMAL(10,2) DEFAULT 0.00 COMMENT '账户余额(充值)',
  `points` INT DEFAULT 0 COMMENT '积分',
  `source` ENUM('walk_in','online','referral','other') DEFAULT 'walk_in' COMMENT '客户来源',
  `referrer_id` INT COMMENT '推荐人ID(关联customers)',
  `remark` TEXT COMMENT '备注',
  `is_deleted` TINYINT DEFAULT 0 COMMENT '软删除标记',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (`phone`),
  INDEX idx_openid (`wechat_openid`),
  INDEX idx_member (`member_level`),
  FOREIGN KEY (`referrer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户信息表';

-- ============================================
-- 3. 车辆表
-- ============================================
CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '车辆ID',
  `customer_id` INT NOT NULL COMMENT '所属客户ID',
  `plate_number` VARCHAR(20) UNIQUE NOT NULL COMMENT '车牌号',
  `vin` VARCHAR(50) COMMENT '车架号(VIN)',
  `brand` VARCHAR(50) COMMENT '品牌(宝马/奔驰/丰田等)',
  `model` VARCHAR(100) COMMENT '车型(3系/GLC/卡罗拉等)',
  `year` INT COMMENT '年款',
  `color` VARCHAR(30) COMMENT '颜色',
  `engine_type` VARCHAR(50) COMMENT '发动机型号',
  `transmission` ENUM('manual','auto','cvt','dct','other') COMMENT '变速箱类型',
  `mileage` INT DEFAULT 0 COMMENT '当前里程(km)',
  `fuel_type` ENUM('gasoline','diesel','hybrid','electric','other') DEFAULT 'gasoline' COMMENT '燃料类型',
  `insurance_company` VARCHAR(100) COMMENT '保险公司',
  `insurance_expire` DATE COMMENT '保险到期日',
  `inspection_expire` DATE COMMENT '年检到期日',
  `last_maintenance_date` DATE COMMENT '最后保养日期',
  `last_maintenance_mileage` INT COMMENT '最后保养里程',
  `status` ENUM('active','in_repair','inactive') DEFAULT 'active' COMMENT '状态',
  `remark` TEXT COMMENT '备注',
  `is_deleted` TINYINT DEFAULT 0 COMMENT '软删除标记',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer (`customer_id`),
  INDEX idx_plate (`plate_number`),
  INDEX idx_vin (`vin`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户车辆表';

-- ============================================
-- 4. 配件/商品表
-- ============================================
CREATE TABLE IF NOT EXISTS `parts` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '配件ID',
  `code` VARCHAR(50) UNIQUE NOT NULL COMMENT '配件编码/SKU',
  `name` VARCHAR(200) NOT NULL COMMENT '配件名称',
  `category` ENUM('engine','chassis','brake','tire','battery','oil','filter','electrical','body','other') NOT NULL COMMENT '分类',
  `brand` VARCHAR(100) COMMENT '品牌',
  `specification` VARCHAR(200) COMMENT '规格型号(如: 205/55R16)',
  `unit` VARCHAR(20) DEFAULT '个' COMMENT '单位',
  `purchase_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '进货价',
  `sell_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '销售价',
  `stock_quantity` INT NOT NULL DEFAULT 0 COMMENT '库存数量',
  `min_stock` INT DEFAULT 5 COMMENT '最低库存预警线',
  `supplier_id` INT COMMENT '供应商ID',
  `compatible_vehicles` TEXT COMMENT '适用车型(JSON数组)',
  `image_url` VARCHAR(255) COMMENT '图片URL',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 1上架 0下架',
  `is_deleted` TINYINT DEFAULT 0 COMMENT '软删除标记',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (`code`),
  INDEX idx_category (`category`),
  INDEX idx_brand (`brand`),
  INDEX idx_stock (`stock_quantity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配件/商品信息表';

-- ============================================
-- 5. 供应商表
-- ============================================
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '供应商ID',
  `name` VARCHAR(200) NOT NULL COMMENT '供应商名称',
  `contact_person` VARCHAR(100) COMMENT '联系人',
  `phone` VARCHAR(20) COMMENT '联系电话',
  `address` VARCHAR(255) COMMENT '地址',
  `settlement_type` ENUM('cash','monthly','other') DEFAULT 'cash' COMMENT '结算方式',
  `remark` TEXT COMMENT '备注',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 1合作 0停止',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商信息表';

-- ============================================
-- 6. 库存变动记录表
-- ============================================
CREATE TABLE IF NOT EXISTS `stock_logs` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '记录ID',
  `part_id` INT NOT NULL COMMENT '配件ID',
  `type` ENUM('in','out','return','adjust') NOT NULL COMMENT '类型: 入库/出库/退货/调整',
  `quantity` INT NOT NULL COMMENT '数量(正负数表示方向)',
  `before_quantity` INT NOT NULL COMMENT '变动前库存',
  `after_quantity` INT NOT NULL COMMENT '变动后库存',
  `order_id` INT COMMENT '关联工单ID',
  `purchase_id` INT COMMENT '关联采购单ID',
  `operator_id` INT NOT NULL COMMENT '操作人ID',
  `remark` TEXT COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_part (`part_id`),
  INDEX idx_type (`type`),
  INDEX idx_created (`created_at`),
  FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存变动记录表';

-- ============================================
-- 7. 维修工单表
-- ============================================
CREATE TABLE IF NOT EXISTS `repair_orders` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '工单ID',
  `order_no` VARCHAR(50) UNIQUE NOT NULL COMMENT '工单编号(格式: HY+年月日+序号)',
  `customer_id` INT NOT NULL COMMENT '客户ID',
  `vehicle_id` INT NOT NULL COMMENT '车辆ID',
  `receptionist_id` INT NOT NULL COMMENT '接待员ID',
  `technician_id` INT COMMENT '指派技师ID',
  `type` ENUM('maintenance','repair','tire','battery','chassis','inspection','other') NOT NULL COMMENT '工单类型',
  `status` ENUM('pending','diagnosing','repairing','waiting_parts','quality_check','completed','cancelled') DEFAULT 'pending' COMMENT '状态',
  `priority` ENUM('normal','urgent','emergency') DEFAULT 'normal' COMMENT '优先级',
  `appointment_time` DATETIME COMMENT '预约时间',
  `check_in_time` DATETIME COMMENT '到店时间',
  `start_time` DATETIME COMMENT '开工时间',
  `estimated_finish_time` DATETIME COMMENT '预计完工时间',
  `actual_finish_time` DATETIME COMMENT '实际完工时间',
  `customer_complaint` TEXT COMMENT '客户描述故障/需求',
  `diagnosis_result` TEXT COMMENT '诊断结果',
  `solution` TEXT COMMENT '维修方案',
  `labor_cost` DECIMAL(10,2) DEFAULT 0.00 COMMENT '工时费',
  `parts_cost` DECIMAL(10,2) DEFAULT 0.00 COMMENT '配件费',
  `other_fee` DECIMAL(10,2) DEFAULT 0.00 COMMENT '其他费用(拖车/洗车等)',
  `discount_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '优惠金额',
  `total_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '总金额',
  `paid_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT '已付金额',
  `payment_status` ENUM('unpaid','partial','paid','refunded') DEFAULT 'unpaid' COMMENT '支付状态',
  `payment_method` ENUM('cash','wechat','alipay','bank_transfer','card','balance','other') COMMENT '支付方式',
  `mileage` INT COMMENT '进厂里程',
  `fuel_level` ENUM('empty','quarter','half','three_quarter','full') COMMENT '进厂油量',
  `vehicle_appearance` TEXT COMMENT '车辆外观检查(JSON)',
  `customer_items` TEXT COMMENT '车内物品登记(JSON)',
  `warranty_period` INT DEFAULT 90 COMMENT '质保期(天)',
  `remark` TEXT COMMENT '备注',
  `is_deleted` TINYINT DEFAULT 0 COMMENT '软删除标记',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_no (`order_no`),
  INDEX idx_customer (`customer_id`),
  INDEX idx_vehicle (`vehicle_id`),
  INDEX idx_status (`status`),
  INDEX idx_type (`type`),
  INDEX idx_created (`created_at`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`receptionist_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维修工单主表';

-- ============================================
-- 8. 工单项目明细表
-- ============================================
CREATE TABLE IF NOT EXISTS `repair_items` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '明细ID',
  `order_id` INT NOT NULL COMMENT '工单ID',
  `type` ENUM('labor','part','other') NOT NULL COMMENT '类型: 工时/配件/其他',
  `name` VARCHAR(200) NOT NULL COMMENT '项目名称',
  `part_id` INT COMMENT '关联配件ID(类型为part时)',
  `quantity` INT DEFAULT 1 COMMENT '数量',
  `unit_price` DECIMAL(10,2) NOT NULL COMMENT '单价',
  `total_price` DECIMAL(10,2) NOT NULL COMMENT '总价',
  `technician` VARCHAR(100) COMMENT '施工技师',
  `remark` TEXT COMMENT '备注',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order (`order_id`),
  FOREIGN KEY (`order_id`) REFERENCES `repair_orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单项目明细表';

-- ============================================
-- 9. 工单进度跟踪表
-- ============================================
CREATE TABLE IF NOT EXISTS `order_timeline` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '记录ID',
  `order_id` INT NOT NULL COMMENT '工单ID',
  `status` VARCHAR(50) NOT NULL COMMENT '状态节点',
  `description` TEXT COMMENT '描述',
  `operator_id` INT NOT NULL COMMENT '操作人ID',
  `images` TEXT COMMENT '图片(JSON数组)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order (`order_id`),
  FOREIGN KEY (`order_id`) REFERENCES `repair_orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单进度时间线';

-- ============================================
-- 10. 预约表
-- ============================================
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '预约ID',
  `customer_id` INT COMMENT '客户ID(已注册)',
  `vehicle_id` INT COMMENT '车辆ID',
  `customer_name` VARCHAR(100) COMMENT '客户姓名(未注册)',
  `customer_phone` VARCHAR(20) COMMENT '客户电话(未注册)',
  `plate_number` VARCHAR(20) COMMENT '车牌号(未注册)',
  `service_type` ENUM('maintenance','repair','tire','battery','chassis','inspection','other') NOT NULL COMMENT '服务类型',
  `appointment_time` DATETIME NOT NULL COMMENT '预约时间',
  `estimated_duration` INT DEFAULT 60 COMMENT '预计耗时(分钟)',
  `customer_remark` TEXT COMMENT '客户备注',
  `status` ENUM('pending','confirmed','arrived','cancelled','completed') DEFAULT 'pending' COMMENT '状态',
  `source` ENUM('miniprogram','phone','walk_in','other') DEFAULT 'miniprogram' COMMENT '预约来源',
  `order_id` INT COMMENT '关联工单ID(到店后生成)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer (`customer_id`),
  INDEX idx_time (`appointment_time`),
  INDEX idx_status (`status`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`order_id`) REFERENCES `repair_orders`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预约登记表';

-- ============================================
-- 11. 支付记录表
-- ============================================
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '支付ID',
  `order_id` INT NOT NULL COMMENT '工单ID',
  `amount` DECIMAL(10,2) NOT NULL COMMENT '支付金额',
  `method` ENUM('cash','wechat','alipay','bank_transfer','card','balance','other') NOT NULL COMMENT '支付方式',
  `status` ENUM('pending','success','failed','refunded') DEFAULT 'pending' COMMENT '状态',
  `transaction_id` VARCHAR(100) COMMENT '第三方交易号',
  `payer_id` INT COMMENT '付款人(客户)',
  `collector_id` INT COMMENT '收款人(员工)',
  `remark` TEXT COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order (`order_id`),
  INDEX idx_status (`status`),
  FOREIGN KEY (`order_id`) REFERENCES `repair_orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`payer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`collector_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付记录表';

-- ============================================
-- 12. 消息/通知表
-- ============================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '消息ID',
  `receiver_id` INT COMMENT '接收人ID(客户或员工)',
  `receiver_type` ENUM('customer','user') NOT NULL COMMENT '接收人类型',
  `type` ENUM('maintenance_remind','appointment_remind','order_status','promotion','system','stock_alert','other') NOT NULL COMMENT '消息类型',
  `title` VARCHAR(200) NOT NULL COMMENT '标题',
  `content` TEXT NOT NULL COMMENT '内容',
  `related_id` INT COMMENT '关联ID(工单/预约等)',
  `is_read` TINYINT DEFAULT 0 COMMENT '是否已读',
  `send_time` DATETIME COMMENT '计划发送时间',
  `sent_at` DATETIME COMMENT '实际发送时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_receiver (`receiver_id`,`receiver_type`),
  INDEX idx_type (`type`),
  INDEX idx_read (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息通知表';

-- ============================================
-- 13. 保养提醒规则表
-- ============================================
CREATE TABLE IF NOT EXISTS `maintenance_reminders` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '提醒ID',
  `vehicle_id` INT NOT NULL COMMENT '车辆ID',
  `type` ENUM('mileage','date','both') NOT NULL COMMENT '提醒类型: 按里程/按日期/两者',
  `mileage_interval` INT COMMENT '保养间隔里程(km)',
  `month_interval` INT COMMENT '保养间隔月数',
  `last_mileage` INT COMMENT '上次保养里程',
  `last_date` DATE COMMENT '上次保养日期',
  `next_mileage` INT COMMENT '下次保养里程',
  `next_date` DATE COMMENT '下次保养日期',
  `status` ENUM('active','paused','completed') DEFAULT 'active' COMMENT '状态',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vehicle (`vehicle_id`),
  FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保养提醒规则表';

-- ============================================
-- 14. 营业日报/数据统计表
-- ============================================
CREATE TABLE IF NOT EXISTS `daily_reports` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '报表ID',
  `date` DATE UNIQUE NOT NULL COMMENT '日期',
  `total_orders` INT DEFAULT 0 COMMENT '工单总数',
  `completed_orders` INT DEFAULT 0 COMMENT '完工工单数',
  `total_revenue` DECIMAL(10,2) DEFAULT 0.00 COMMENT '总营收',
  `labor_revenue` DECIMAL(10,2) DEFAULT 0.00 COMMENT '工时费收入',
  `parts_revenue` DECIMAL(10,2) DEFAULT 0.00 COMMENT '配件收入',
  `new_customers` INT DEFAULT 0 COMMENT '新增客户数',
  `appointments_count` INT DEFAULT 0 COMMENT '预约数',
  `average_order_value` DECIMAL(10,2) DEFAULT 0.00 COMMENT '客单价',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营业日报表';

-- ============================================
-- 15. 硬件设备表
-- ============================================
CREATE TABLE IF NOT EXISTS `hardware_devices` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '设备ID',
  `name` VARCHAR(100) NOT NULL COMMENT '设备名称',
  `type` ENUM('printer','diagnostic','lifter','camera','scanner','other') NOT NULL COMMENT '设备类型',
  `brand` VARCHAR(50) COMMENT '品牌',
  `model` VARCHAR(100) COMMENT '型号',
  `serial_number` VARCHAR(100) COMMENT '序列号',
  `ip_address` VARCHAR(50) COMMENT 'IP地址',
  `port` INT COMMENT '端口',
  `status` ENUM('online','offline','error') DEFAULT 'offline' COMMENT '状态',
  `last_heartbeat` DATETIME COMMENT '最后心跳时间',
  `config` TEXT COMMENT '配置信息(JSON)',
  `remark` TEXT COMMENT '备注',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (`type`),
  INDEX idx_status (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='硬件设备表';

-- ============================================
-- 初始化数据
-- ============================================

-- 默认管理员账号 (密码: admin123)
INSERT INTO `users` (`username`, `password`, `real_name`, `phone`, `role`) VALUES
('admin', '$2b$10$8K1p/a0dL3LzKvQ/PHxUeOqYwvDZzGqGqZqZqZqZqZqZqZqZqZqZ.', '系统管理员', '13800000000', 'admin');

-- 默认配件分类示例
INSERT INTO `parts` (`code`, `name`, `category`, `brand`, `specification`, `unit`, `purchase_price`, `sell_price`, `stock_quantity`, `min_stock`) VALUES
('TYRE-001', '米其林 Energy XM2+ 205/55R16', 'tire', '米其林', '205/55R16 91V', '条', 350.00, 580.00, 8, 4),
('TYRE-002', '马牌 UC6 195/65R15', 'tire', '马牌', '195/65R15 91H', '条', 280.00, 450.00, 6, 4),
('BAT-001', '瓦尔塔 启停蓄电池 H5-60', 'battery', '瓦尔塔', '12V 60Ah', '个', 320.00, 520.00, 5, 2),
('OIL-001', '壳牌 黄壳 HX7 5W-30 4L', 'oil', '壳牌', '5W-30 SN级', '桶', 85.00, 158.00, 20, 5),
('OIL-002', '美孚 速霸 5W-40 4L', 'oil', '美孚', '5W-40 SN级', '桶', 95.00, 168.00, 15, 5),
('FLT-001', '博世 机油滤芯 适配通用', 'filter', '博世', '通用型', '个', 8.00, 25.00, 30, 10),
('FLT-002', '博世 空气滤芯 适配通用', 'filter', '博世', '通用型', '个', 12.00, 35.00, 20, 8),
('BRK-001', '博世 刹车片 前轮 适配通用', 'brake', '博世', '通用型', '套', 65.00, 180.00, 10, 3),
('CHS-001', '下摆臂(左) 适配通用', 'chassis', 'TRW', '通用型', '个', 80.00, 220.00, 4, 2);

-- 默认供应商
INSERT INTO `suppliers` (`name`, `contact_person`, `phone`, `settlement_type`) VALUES
('天津金达轮胎批发', '张经理', '022-88886666', 'monthly'),
('天津恒信汽配城', '李老板', '022-66668888', 'monthly'),
('壳牌润滑油天津代理', '王经理', '022-77777777', 'cash');

-- 创建视图：工单统计视图
CREATE OR REPLACE VIEW `v_order_summary` AS
SELECT
  ro.id,
  ro.order_no,
  c.name AS customer_name,
  c.phone AS customer_phone,
  v.plate_number,
  v.brand,
  v.model,
  ro.type,
  ro.status,
  ro.total_amount,
  ro.paid_amount,
  ro.payment_status,
  u1.real_name AS receptionist,
  u2.real_name AS technician,
  ro.created_at
FROM repair_orders ro
LEFT JOIN customers c ON ro.customer_id = c.id
LEFT JOIN vehicles v ON ro.vehicle_id = v.id
LEFT JOIN users u1 ON ro.receptionist_id = u1.id
LEFT JOIN users u2 ON ro.technician_id = u2.id
WHERE ro.is_deleted = 0;

-- 创建视图：客户消费统计
CREATE OR REPLACE VIEW `v_customer_summary` AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.member_level,
  c.total_spent,
  c.balance,
  COUNT(DISTINCT v.id) AS vehicle_count,
  COUNT(DISTINCT ro.id) AS order_count,
  MAX(ro.created_at) AS last_visit
FROM customers c
LEFT JOIN vehicles v ON c.id = v.customer_id AND v.is_deleted = 0
LEFT JOIN repair_orders ro ON c.id = ro.customer_id AND ro.is_deleted = 0
WHERE c.is_deleted = 0
GROUP BY c.id;

COMMIT;
