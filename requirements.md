# 翻译阅读器需求文档

## 技术栈

- **框架**: Electron
- **前端**: React + TypeScript
- **UI组件**: Ant Design
- **状态管理**: Zustand
- **EPUB解析**: epub.js
- **数据存储**: SQLite (better-sqlite3)
- **样式**: TailwindCSS

## 核心功能

### 1. 双模式支持

| 模式 | 功能 |
|------|------|
| **只读模式** | 电子书翻页、跳转、目录导航 |
| **翻译模式** | 文本分段、翻译、编辑、工程管理 |

### 2. 界面布局

```
┌──────────┬────────────────────────┬──────────────┐
│  目录列  │      内容展示列        │  翻译信息列  │
│  (TOC)   │      (最宽)            │  (可折叠)    │
└──────────┴────────────────────────┴──────────────┘
```

- **左列**: 显示章节目录
- **中列**: 显示阅读/编辑内容（最宽）
- **右列**: 翻译结果+补充说明（只读模式下可折叠，翻译模式下未来支持编辑）

### 3. 工程管理

#### 3.1 新建工程
- 翻译模式下打开EPUB = 创建新工程
- 工程包含：原始文件、分段数据、翻译记录

#### 3.2 工程数据
```
project/
├── project.db          # SQLite: 分段、翻译、关联数据
├── original.epub       # 原始EPUB文件
└── cache/              # 解压的临时文件
```

### 4. 文本处理

#### 4.1 自动分段
- 点击按钮对当前章节进行句/段落划分
- 分段结果保存到工程数据库
- 支持句级和段落级两种粒度

#### 4.2 手动编辑
- 合并相邻分段
- 拆分已有分段

### 5. 翻译流程

#### 5.1 翻译操作
```
1. 点击已划分的句/段落
2. 发送到翻译API
3. 右侧展示：
   - 翻译结果
   - 补充说明/注释
   - 操作按钮：[接受] [废弃] [重试]
   - 未来支持：直接编辑翻译文本
```

#### 5.2 翻译结果处理
- **接受**: 翻译附加到原文后，补充信息关联保存
- **废弃**: 丢弃当前翻译
- **重试**: 重新请求翻译

#### 5.3 部分翻译处理
**示例**: 段落包含句子 `a b c d e`

- 仅翻译句子 `c` → 结果 `C`
- 最终显示: `a b c C d e`
- 导出要求:
  - `C` 与 `c` 样式一致
  - `C` 添加下划线等连接标识

### 6. 数据结构

```typescript
// 分段
interface Segment {
  id: string;
  originalText: string;
  translation?: Translation;
  merged?: boolean;
  split?: boolean;
}

// 翻译
interface Translation {
  text: string;
  notes: string[];      // 补充说明
  accepted: boolean;
  timestamp: Date;
}
```

### 7. 导出功能

- 打包工程为标准EPUB格式
- 包含原文+已接受的翻译
- 保留原始样式
- 翻译文本标记（下划线等）
- 可在其他阅读器中正常打开

### 8. 工程恢复

- 打开已有工程
- 读取未完成的翻译数据
- 继续翻译或修改已有内容

## 文件格式支持

- **当前阶段**: 仅支持 EPUB 格式
- **未来扩展**: PDF、MOBI 等

## 数据存储方案

### SQLite 选型理由

| 特性 | 说明 |
|------|------|
| **集成方式** | better-sqlite3 (同步API,性能优异) |
| **存储位置** | 工程目录下 project.db 文件 |
| **优势** | 单文件、无需服务、支持完整SQL、易备份 |
| **适用场景** | 本地单用户应用 |

### 数据库操作

- Main 进程负责所有 SQLite 操作
- Renderer 进程通过 IPC 调用
- 支持事务保证数据一致性

## 数据库表设计

```sql
-- 工程表
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  epub_path TEXT,
  created_at DATETIME,
  metadata TEXT
);

-- 分段表
CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  chapter_id TEXT,
  original_text TEXT,
  position INTEGER,
  parent_group TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 翻译表
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  segment_id TEXT,
  text TEXT,
  notes TEXT,
  accepted BOOLEAN,
  created_at DATETIME,
  FOREIGN KEY (segment_id) REFERENCES segments(id)
);
```

## 开发阶段

| 阶段 | 功能 |
|------|------|
| Phase 1 | EPUB解析 + 只读模式 + 界面布局 |
| Phase 2 | 自动分段 + 翻译集成 + 右侧面板 |
| Phase 3 | 工程管理 + 数据持久化 |
| Phase 4 | 手动编辑 + EPUB导出 |
