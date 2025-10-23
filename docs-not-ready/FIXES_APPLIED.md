# ReadTranslate 问题修复记录

## 错误: "Cannot read properties of null (reading 'prepare')"

### 问题描述
创建项目时失败，错误为 `Cannot read properties of null (reading 'prepare')`。

### 根本原因
1. **better-sqlite3 模块版本不匹配**
   - Electron 使用自己的 Node.js 版本
   - npm install 安装的模块是为系统 Node 编译的
   - Electron 运行时加载 better-sqlite3.node 时版本不匹配

2. **数据库初始化失败**
   - 由于模块加载失败，`this.db` 为 null
   - 后续调用 `this.db.prepare()` 时抛出异常

### 修复方案

#### 步骤 1: 改进数据库错误处理（database.js）

添加防御性检查来捕获初始化失败：

```javascript
// 在 initializeGlobalDB() 中
try {
  this.db = new Database(this.dbPath)
} catch (error) {
  console.error('初始化数据库失败:', error.message)
  console.error('请运行: npm rebuild better-sqlite3')
  throw new Error('数据库初始化失败，请检查日志')
}

// 在 getProject() 中
if (!this.db) {
  console.error('数据库未初始化')
  return null
}

// 在 createProject() 中
if (!this.db) {
  throw new Error('数据库未初始化')
}
```

#### 步骤 2: 重新安装 better-sqlite3

```bash
rm -rf node_modules/better-sqlite3
npm install better-sqlite3
```

#### 步骤 3: 为 Electron 重新编译模块

```bash
npx electron-rebuild -f
```

这是关键步骤，确保 better-sqlite3 与 Electron 的 Node 版本兼容。

### 验证修复

修复后的日志输出：
```
初始化全局数据库: /Users/rhinenoir/Library/Application Support/read-translate/database/app.db
```

✅ 数据库初始化成功
✅ 应用正常启动
✅ IPC 通信工作正常

### 相关文件修改

- `services/database.js` - 添加数据库初始化检查

### 相关命令

```bash
# 如果再次出现此错误
npx electron-rebuild -f

# 快速启动应用
bash start.sh

# 查看详细日志
tail -f /tmp/electron.log
```

### 关键学习

- ✅ Electron 有自己的 Node.js 版本，原生模块需要特殊编译
- ✅ 使用 `electron-rebuild` 而不是 `npm rebuild` 来处理 Electron 项目
- ✅ 添加防御性检查可以提供更清晰的错误消息
- ✅ 对于原生模块的问题，优先检查版本是否匹配

---

**修复日期**: 2025-10-22
**修复提交**: d4d0e60
**状态**: ✅ 已解决
