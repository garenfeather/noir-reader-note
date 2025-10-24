#!/bin/bash

#######################################
# ReadTranslate 停止脚本
# 功能：停止所有服务并释放端口
#######################################

set -e

VITE_PORT=5173

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}ReadTranslate 停止脚本${NC}"
echo -e "${YELLOW}========================================${NC}\n"

echo -e "${YELLOW}正在停止服务...${NC}\n"

# 停止 npm/vite 相关进程
pids=$(pgrep -f "npm run electron:dev|concurrently|vite|wait-on http://localhost" 2>/dev/null || true)
if [ -n "$pids" ]; then
  echo "$pids" | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}✓ 已停止 npm/vite 进程${NC}"
else
  echo -e "${YELLOW}⊘ 未发现 npm/vite 进程${NC}"
fi

# 停止所有 Electron 进程
electron_pids=$(pgrep -i "Electron" 2>/dev/null || true)
if [ -n "$electron_pids" ]; then
  echo "$electron_pids" | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}✓ 已停止 Electron 进程${NC}"
else
  echo -e "${YELLOW}⊘ 未发现 Electron 进程${NC}"
fi

# 释放端口
port_pids=$(lsof -i :${VITE_PORT} 2>/dev/null | grep -v COMMAND | awk '{print $2}' || true)
if [ -n "$port_pids" ]; then
  echo "$port_pids" | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}✓ 已释放端口 ${VITE_PORT}${NC}"
else
  echo -e "${YELLOW}⊘ 端口 ${VITE_PORT} 未被占用${NC}"
fi

sleep 1

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${GREEN}所有服务已停止！${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
