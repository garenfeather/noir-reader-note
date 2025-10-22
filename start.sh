#!/bin/bash

#####################################################################
# ReadTranslate 服务启动脚本
#
# 用法:
#   bash start.sh              # 简单启动（使用 dev.sh）
#   bash start.sh --full       # 完整启动（使用 restart-services.sh）
#   bash start.sh --help       # 显示帮助信息
#
#####################################################################

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
  cat << EOF
${BLUE}=====================================
ReadTranslate 服务启动脚本
=====================================${NC}

用法:
  ${GREEN}bash start.sh${NC}              快速启动（推荐日常使用）
  ${GREEN}bash start.sh --full${NC}       完整启动（完整清理和诊断）
  ${GREEN}bash start.sh --help${NC}       显示此帮助信息

快速启动 (dev.sh):
  ✓ 杀死旧进程
  ✓ 启动 Vite 开发服务
  ✓ 启动 Electron 应用
  ✓ 速度快（~5秒）

完整启动 (restart-services.sh):
  ✓ 杀死旧进程并释放端口
  ✓ 验证开发环境
  ✓ 启动所有服务
  ✓ 诊断和日志
  ✓ 更详细（~30秒）

快捷命令:
  ${YELLOW}tail -f /tmp/vite.log${NC}    查看 Vite 日志
  ${YELLOW}tail -f /tmp/electron.log${NC} 查看 Electron 日志
  ${YELLOW}pkill -9 -f 'npm run|electron|vite'${NC} 停止所有服务

${BLUE}=====================================
${NC}
EOF
}

# 检查参数
case "${1:-}" in
  --help)
    show_help
    exit 0
    ;;
  --full)
    echo -e "${YELLOW}使用完整启动模式...${NC}\n"
    bash "${PROJECT_DIR}/restart-services.sh"
    exit $?
    ;;
  *)
    echo -e "${YELLOW}使用快速启动模式...${NC}\n"
    bash "${PROJECT_DIR}/dev.sh"
    exit $?
    ;;
esac
