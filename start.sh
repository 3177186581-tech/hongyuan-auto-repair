#!/bin/bash
# 宏源汽车服务管理系统 - 一键启动脚本

echo "========================================="
echo "  宏源汽车服务管理系统 - 启动中..."
echo "========================================="

# 检查 MySQL 是否运行
if ! mysqladmin ping -u root -p123456 --silent 2>/dev/null; then
    echo "[!] MySQL 未运行，请先启动 MySQL 服务"
    echo "    Ubuntu/Debian: sudo systemctl start mysql"
    echo "    macOS: sudo mysql.server start"
    exit 1
fi
echo "[✓] MySQL 已连接"

# 初始化数据库（如果尚未初始化）
DB_EXISTS=$(mysql -u root -p123456 -e "SHOW DATABASES LIKE 'hongyuan_auto_repair'" 2>/dev/null | grep hongyuan)
if [ -z "$DB_EXISTS" ]; then
    echo "[→] 正在初始化数据库..."
    mysql -u root -p123456 < backend/database.sql 2>/dev/null
    echo "[✓] 数据库初始化完成"
else
    echo "[✓] 数据库已存在，跳过初始化"
fi

# 安装后端依赖
if [ ! -d "backend/node_modules" ]; then
    echo "[→] 正在安装后端依赖..."
    cd backend && npm install express mysql2 cors body-parser jsonwebtoken multer 2>/dev/null && cd ..
    echo "[✓] 后端依赖安装完成"
fi

# 启动后端服务（后台运行）
echo "[→] 启动后端服务（端口 3000）..."
cd backend && nohup node server.js > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo $BACKEND_PID > .backend.pid
sleep 2

# 启动前端（端口 8080）
echo "[→] 启动前端服务（端口 8080）..."
cd frontend && nohup python3 -m http.server 8080 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo $FRONTEND_PID > .frontend.pid
sleep 1

echo ""
echo "========================================="
echo "  🎉 宏源汽车服务管理系统 已启动！"
echo "========================================="
echo ""
echo "  📱 管理后台:  http://localhost:8080"
echo "  🔧 后端API:   http://localhost:3000/api"
echo "  📱 小程序端:   打开 miniprogram/index.html"
echo ""
echo "  默认账号: admin / admin123"
echo ""
echo "  日志目录: logs/"
echo "  停止服务: bash stop.sh"
echo "========================================="
