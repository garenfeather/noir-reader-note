#!/bin/bash

###############################################
# ReadTranslate 快速启动脚本
# 用法: bash dev.sh 或 ./dev.sh
###############################################

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${PROJECT_DIR}"

echo "=== ReadTranslate 快速启动 ==="
echo ""

# 1. 杀死所有旧进程
echo "1️⃣  清理旧进程..."
pkill -9 -f "npm run|electron|vite" 2>/dev/null || true
lsof -i :5173 2>/dev/null | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null || true
sleep 2

# 2. 启动 Vite 开发服务
echo "2️⃣  启动 Vite 开发服务..."
npm run dev > /tmp/vite.log 2>&1 &
VITE_PID=$!
echo "   PID: $VITE_PID"

# 3. 等待 Vite 就绪
echo "3️⃣  等待 Vite 启动..."
for i in {1..20}; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "   ✅ Vite 已就绪"
    break
  fi
  echo -n "."
  sleep 1
done

# 4. 启动 Electron
echo ""
echo "4️⃣  启动 Electron 应用..."
npx electron . > /tmp/electron.log 2>&1 &
ELECTRON_PID=$!
echo "   PID: $ELECTRON_PID"

echo ""
echo "=== 服务已启动 ==="
echo ""
echo "📝 日志文件："
echo "   Vite: tail -f /tmp/vite.log"
echo "   Electron: tail -f /tmp/electron.log"
echo ""
echo "🛑 停止服务："
echo "   pkill -9 -f 'npm run|electron|vite'"
echo ""
