# ReadTranslate 服务启动指南

## 快速开始

### 最简单的方式（推荐）

```bash
bash start.sh
```

这会自动：
- 清理旧进程
- 启动 Vite 开发服务（http://localhost:5173）
- 启动 Electron 应用窗口

## 脚本详解

### 1. start.sh（主脚本）

这是入口脚本，支持多种启动模式：

```bash
# 快速启动（默认，推荐）
bash start.sh

# 完整启动（清理更彻底，包含诊断）
bash start.sh --full

# 显示帮助信息
bash start.sh --help
```

**选择建议：**
- 日常开发：`bash start.sh`（速度快，~5秒）
- 遇到问题：`bash start.sh --full`（诊断完整，~30秒）

---

### 2. dev.sh（快速启动脚本）

快速启动脚本，用于日常开发。

```bash
bash dev.sh
```

**功能：**
- ✅ 杀死所有旧 Vite/Electron/npm 进程
- ✅ 清空占用的端口
- ✅ 启动 Vite 开发服务
- ✅ 等待 Vite 就绪
- ✅ 启动 Electron 应用
- ✅ 输出日志路径

**速度：** ~5秒

---

### 3. restart-services.sh（完整启动脚本）

完整的启动脚本，包含诊断和详细的日志。

```bash
bash restart-services.sh
```

**功能：**
- ✅ 杀死所有旧进程
- ✅ 释放占用的端口
- ✅ 验证 Node.js 和 npm
- ✅ 验证项目结构
- ✅ 启动服务
- ✅ 诊断服务就绪状态
- ✅ 生成详细日志

**速度：** ~30秒

---

## 常用命令

### 查看日志

```bash
# 查看 Vite 开发服务日志（实时）
tail -f /tmp/vite.log

# 查看 Electron 应用日志（实时）
tail -f /tmp/electron.log
```

### 停止服务

```bash
# 停止所有相关服务
pkill -9 -f 'npm run|electron|vite'
```

### 重启服务

```bash
# 快速重启
bash start.sh

# 完整重启
bash start.sh --full
```

---

## 故障排除

### 问题：Electron 窗口未显示

**解决步骤：**

1. 检查是否有错误的 Electron 进程在运行：
   ```bash
   ps aux | grep -i electron | grep -v grep
   ```

2. 使用完整重启：
   ```bash
   bash start.sh --full
   ```

3. 查看日志：
   ```bash
   tail -f /tmp/electron.log
   ```

### 问题：端口 5173 已被占用

脚本会自动处理这个问题，但如果仍然出现：

```bash
# 查看占用端口的进程
lsof -i :5173

# 杀死占用进程（PID 替换为实际 PID）
kill -9 <PID>
```

### 问题：Vite 开发服务启动失败

1. 检查 Node 版本（需要 v14+）：
   ```bash
   node --version
   ```

2. 重新安装依赖：
   ```bash
   npm install
   npm rebuild
   ```

3. 清理缓存并重启：
   ```bash
   rm -rf node_modules/.vite
   bash start.sh --full
   ```

---

## 进程管理

### 查看运行中的进程

```bash
# 查看 Vite 进程
ps aux | grep vite | grep -v grep

# 查看 Electron 进程
ps aux | grep "read-translate" | grep -v grep

# 查看端口占用
lsof -i :5173
```

### 自动清理

脚本会自动清理以下内容：
- 旧的 npm/vite/electron 进程
- 占用 5173 端口的进程
- 临时日志文件

---

## 开发工作流

### 典型流程

```bash
# 1. 启动服务
bash start.sh

# 2. 修改代码（自动热重载）

# 3. 查看日志
tail -f /tmp/electron.log

# 4. 遇到问题时重启
bash start.sh
```

### 保持日志窗口开启

```bash
# 在一个终端标签页保持实时日志
tail -f /tmp/vite.log

# 在另一个终端标签页保持实时日志
tail -f /tmp/electron.log

# 在主终端运行
bash start.sh
```

---

## 技术细节

### 脚本使用的命令

| 命令 | 功能 |
|------|------|
| `pkill` | 按名称查找并杀死进程 |
| `lsof` | 查看端口占用情况 |
| `curl` | 检查 Vite 服务是否就绪 |
| `nohup` | 后台运行命令 |
| `pgrep` | 按名称查找进程 |

### 脚本检查的端口

| 端口 | 服务 |
|------|------|
| 5173 | Vite 开发服务 |

### 脚本生成的日志文件

| 文件 | 内容 |
|------|------|
| `/tmp/vite.log` | Vite 开发服务日志 |
| `/tmp/electron.log` | Electron 应用日志 |

---

## FAQ

**Q: 可以同时运行多个实例吗？**

A: 不推荐。脚本会杀死旧进程，所以同一时间只能运行一个实例。

**Q: 如何修改日志文件位置？**

A: 编辑脚本中的 `ELECTRON_LOG_FILE` 变量（在 restart-services.sh 中）或修改 dev.sh 中的 `/tmp/` 路径。

**Q: 脚本可以自动启动吗？**

A: 可以。将启动命令添加到 shell 配置文件（如 `.zshrc` 或 `.bash_profile`）：
```bash
alias rtr='bash ~/path/to/start.sh'
```

**Q: 生产环境如何启动？**

A: 使用 `npm run build` 和 `npm run electron:build` 构建应用，然后直接运行可执行文件。

---

## 相关资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Vite 官方文档](https://vitejs.dev/)
- [Node.js 官方网站](https://nodejs.org/)

---

*最后更新: 2025-10-22*
