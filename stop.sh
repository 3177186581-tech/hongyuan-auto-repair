#!/bin/bash
# 停止所有服务

echo "正在停止服务..."

if [ -f ".backend.pid" ]; then
    kill $(cat .backend.pid) 2>/dev/null
    rm .backend.pid
    echo "[✓] 后端服务已停止"
fi

if [ -f ".frontend.pid" ]; then
    kill $(cat .frontend.pid) 2>/dev/null
    rm .frontend.pid
    echo "[✓] 前端服务已停止"
fi

# 额外清理（以防万一）
pkill -f "node server.js" 2>/dev/null
pkill -f "http.server 8080" 2>/dev/null

echo "所有服务已停止"
