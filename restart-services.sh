#!/bin/bash

#######################################
# ReadTranslate 服务重启脚本
# 功能：重启全部服务，自动处理端口占用
#######################################

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VITE_PORT=5173
ELECTRON_LOG_FILE="/tmp/read-translate-electron.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}ReadTranslate 服务重启脚本${NC}"
echo -e "${YELLOW}========================================${NC}\n"

# 1. 杀死现有进程和释放端口
echo -e "${YELLOW}[1/4] 停止现有服务...${NC}"

# 停止 npm run electron:dev 的相关进程
pids=$(pgrep -f "npm run electron:dev|concurrently|vite|wait-on http://localhost" 2>/dev/null || true)
if [ ! -z "$pids" ]; then
  echo "$pids" | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}✓ 已停止现有进程${NC}"
fi

# 停止占用端口的 Electron 和 Node 进程
lsof -i :${VITE_PORT} 2>/dev/null | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null || true
echo -e "${GREEN}✓ 已释放端口 ${VITE_PORT}${NC}"

# 等待进程完全退出
sleep 2

# 2. 验证环境
echo -e "\n${YELLOW}[2/4] 验证开发环境...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js 未安装${NC}"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo -e "${RED}✗ npm 未安装${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Node.js 版本: $(node -v)${NC}"
echo -e "${GREEN}✓ npm 版本: $(npm -v)${NC}"

cd "${PROJECT_DIR}"

if [ ! -f "package.json" ]; then
  echo -e "${RED}✗ package.json 未找到${NC}"
  exit 1
fi

echo -e "${GREEN}✓ 项目目录: ${PROJECT_DIR}${NC}"

# 3. 启动开发服务
echo -e "\n${YELLOW}[3/4] 启动开发服务...${NC}"

# 清理旧的日志文件
rm -f "${ELECTRON_LOG_FILE}"

# 同时启动 Vite 和 Electron
echo "启动 Vite 开发服务..."
nohup npm run dev > "${ELECTRON_LOG_FILE}" 2>&1 &
VITE_PID=$!

sleep 3

echo "启动 Electron 应用..."
nohup npx electron . >> "${ELECTRON_LOG_FILE}" 2>&1 &
ELECTRON_PID=$!

echo -e "${GREEN}✓ Vite 进程 (PID: ${VITE_PID})${NC}"
echo -e "${GREEN}✓ Electron 进程 (PID: ${ELECTRON_PID})${NC}"

# 4. 等待服务启动并验证
echo -e "\n${YELLOW}[4/4] 等待服务就绪...${NC}"

TIMEOUT=30
ELAPSED=0
VITE_READY=false
ELECTRON_READY=false

while [ $ELAPSED -lt $TIMEOUT ]; do
  # 检查 Vite 是否就绪
  if lsof -i :${VITE_PORT} 2>/dev/null | grep -q LISTEN; then
    VITE_READY=true
    echo -e "${GREEN}✓ Vite 开发服务已启动 (http://localhost:${VITE_PORT})${NC}"
  fi

  # 检查 Electron 是否启动（通过进程检查）
  if pgrep -f "Electron" > /dev/null 2>&1; then
    ELECTRON_READY=true
    echo -e "${GREEN}✓ Electron 应用已启动${NC}"
  fi

  if [ "$VITE_READY" = true ] && [ "$ELECTRON_READY" = true ]; then
    break
  fi

  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

echo ""

if [ "$VITE_READY" = true ]; then
  echo -e "${GREEN}✓ 所有服务启动完成！${NC}"
  echo -e "${GREEN}✓ 开发日志: ${ELECTRON_LOG_FILE}${NC}"
else
  echo -e "${RED}✗ 服务启动超时或失败${NC}"
  echo -e "${YELLOW}请检查日志:${NC}"
  tail -20 "${ELECTRON_LOG_FILE}"
  exit 1
fi

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${GREEN}ReadTranslate 已准备就绪！${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "提示："
echo "  - 实时日志: tail -f ${ELECTRON_LOG_FILE}"
echo "  - 停止服务: pkill -f 'npm run electron:dev'"
echo "  - 重启脚本: bash restart-services.sh"
echo ""
