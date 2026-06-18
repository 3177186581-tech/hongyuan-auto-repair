# 宏源汽车服务管理系统

> 一套完整的汽车快修快保门店管理解决方案，包含 Web 管理后台 + 微信小程序客户端 + 硬件对接模块。

## 功能模块

| 模块 | 功能 |
|---|---|
| 🧾 接车开单 | 客户选择、项目明细、自动算价、工单状态流转 |
| 👥 客户管理 | 客户/车辆档案、里程追踪、保养提醒 |
| 📦 配件库存 | 轮胎/电瓶/底盘件等分类管理、入库出库、库存预警 |
| 💰 收银结算 | 多支付方式、工单结算、支付记录查询 |
| 📊 数据统计 | 日/月营收报表、热销排行、趋势图表 |
| 👨‍🔧 员工管理 | 技师/前台账号管理、角色权限 |
| 🔔 消息提醒 | 低库存预警、保养到期提醒 |
| 🖨️ 硬件对接 | 小票打印机(ESC/POS)、举升机状态监控 |

## 技术栈

- **后端**: Node.js + Express + MySQL
- **前端**: 原生 HTML/CSS/JS + Chart.js
- **小程序**: H5（可嵌入微信小程序 WebView）
- **数据库**: MySQL 8.0+

## 快速启动

### 1. 安装依赖
```bash
cd backend
npm install express mysql2 cors body-parser jsonwebtoken multer
```

### 2. 初始化数据库
```bash
mysql -u root -p < database.sql
```

### 3. 启动后端服务
```bash
cd backend
node server.js
```

### 4. 启动前端
```bash
# 方式一：直接打开 frontend/index.html（需要后端已启动）
# 方式二：用任意 HTTP 服务器托管 frontend 目录
cd frontend
python3 -m http.server 8080
```

### 5. 访问系统
- 管理后台: http://localhost:8080（或双击 index.html）
- 默认账号: `admin` / `admin123`
- 小程序端: 用浏览器打开 miniprogram/index.html

## 硬件对接说明

### 小票打印机
- 支持 ESC/POS 指令集的打印机（爱普生 TM-T82III 等）
- 配置打印机 IP 和端口后，系统自动发送打印指令
- 通过 WebSocket 或 HTTP 推送打印内容到打印服务

### 举升机
- 通过串口（COM 口）或网络 TCP 连接
- 实时获取举升机空闲/使用中状态
- 可在前端手动刷新状态

## 目录结构

```
hongyuan-auto-repair/
├── backend/
│   ├── server.js          # Express 后端服务
│   └── database.sql       # 数据库初始化脚本
├── frontend/
│   ├── index.html         # 管理后台页面
│   ├── style.css          # 后台样式
│   └── app.js            # 后台交互逻辑
├── miniprogram/
│   ├── index.html         # 小程序页面
│   ├── style.css          # 小程序样式
│   └── app.js            # 小程序逻辑
└── README.md
```

## 注意事项

1. 数据库密码默认为 `123456`，请根据实际修改 `server.js` 中的配置
2. 前端 API 地址默认为 `http://localhost:3000/api`，部署时请修改
3. 小程序端需替换为真实的微信登录流程（当前为模拟）
4. 建议使用 Chrome 浏览器访问管理后台
