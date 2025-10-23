# Phase 2 实现方案 - EPUB翻译分段功能

## 📋 需求概述

实现EPUB翻译模式下的文本分段功能，包括自动分段、手动编辑、高亮联动等核心能力。

---

## 🎯 核心功能

### 1. 分段展示
- 翻译模式下点击"分割"按钮，将当前章节按段落自动划分
- 右侧栏展示分段结果（仅显示有内容的段落，空段落隐藏但保留）
- 段落卡片显示内容预览

### 2. 双向高亮联动
- 鼠标移到右侧栏段落 → 阅读界面对应部分高亮
- 鼠标移到阅读界面段落 → 右侧栏对应卡片高亮

### 3. 手动分割
- 在阅读界面长按选中文本
- 松开后弹出iOS风格的Context Menu（仅"分割"选项）
- 点击分割后，右侧栏执行"一分为多"的展开动画
- 支持多次手动分割

### 4. 分段确认
- 右侧栏底部显示"接受"和"丢弃"按钮
- **接受**：保存所有分段结果（自动+手动）到数据库
- **丢弃**：放弃所有分段，清空右侧栏，回到初始状态

### 5. 章节范围
- **有目录**：分割用户正在阅读的目录项（当前章节）
- **无目录**：分割当前视口前后三个spine item的内容
- **重要**：确保包含完整段落，不截断句子
- **跨章节**：仅在无目录时允许

---

## 🏗️ 技术架构

### 1. 项目管理

#### 项目创建时机
```
用户在只读模式打开EPUB
    ↓
切换到翻译模式（首次）
    ↓
自动在 projects/ 目录创建项目
    ↓
解压EPUB → 初始化数据库 → 显示"分割"按钮
```

#### 项目目录结构
```
/home/user/read-translate/projects/
└── {epub-name}-{timestamp}/
    ├── project.db          # SQLite数据库
    ├── original.epub       # 原始EPUB文件副本
    └── extracted/          # 解压的EPUB内容
        ├── META-INF/
        ├── OEBPS/ (或其他)
        └── mimetype
```

**项目ID规则**: `{epub文件名}-{时间戳}`
- 示例: `my-book-20250122143025`

#### 修改检测与保存
- **有修改的定义**: 用户点击"接受"保存了至少一次分段结果
- **关闭时行为**:
  - 无修改：直接关闭
  - 有修改：弹出提示"是否保存项目修改？"

---

### 2. 数据库设计

#### 初始化时机
- 应用启动时检查表结构是否存在
- 不存在则创建（全局表结构，非单个项目）

#### 数据表结构

```sql
-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,                -- 项目ID (epub-name-timestamp)
  epub_name TEXT NOT NULL,            -- EPUB文件名
  epub_path TEXT NOT NULL,            -- 原始EPUB路径
  project_path TEXT NOT NULL,         -- 项目目录路径
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT                       -- JSON: EPUB元信息
);

-- 分段表
CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,                -- 分段ID (uuid)
  project_id TEXT NOT NULL,           -- 项目ID
  chapter_id TEXT NOT NULL,           -- 章节ID (spine item id)
  chapter_href TEXT NOT NULL,         -- 章节文件路径
  original_text TEXT NOT NULL,        -- 原始文本
  xpath TEXT NOT NULL,                -- XPath路径
  cfi_range TEXT,                     -- CFI范围（用于定位和高亮）
  position INTEGER NOT NULL,          -- 在章节中的顺序
  is_empty BOOLEAN DEFAULT 0,         -- 是否为空段落
  parent_segment_id TEXT,             -- 手动分割的父分段ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_segments_project ON segments(project_id);
CREATE INDEX IF NOT EXISTS idx_segments_chapter ON segments(chapter_id);
CREATE INDEX IF NOT EXISTS idx_segments_position ON segments(project_id, chapter_id, position);
```

#### IPC通信接口

```typescript
// Renderer → Main
interface IPCHandlers {
  'project:create': (epubPath: string) => Promise<Project>
  'project:get': (projectId: string) => Promise<Project | null>
  'segments:save': (projectId: string, segments: Segment[]) => Promise<void>
  'segments:load': (projectId: string, chapterId: string) => Promise<Segment[]>
}
```

---

### 3. EPUB内容处理

#### 解压工具
- 使用 **`adm-zip`** 库（同步API，简单可靠）

#### 渲染方式（双轨制）
- **阅读界面**: 继续使用 epub.js 渲染（保持现有体验）
- **分段解析**: 从解压的xhtml文件读取原始HTML，解析DOM生成分段

#### 段落提取规则（简单规则）

```typescript
// 被识别为段落的HTML标签
const PARAGRAPH_TAGS = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']

// 空段落判定
function isEmpty(element: Element): boolean {
  return element.textContent?.trim().length === 0
}
```

**处理流程**:
1. 解析xhtml为DOM（使用 `jsdom`）
2. 遍历body，提取所有段落标签
3. 过滤导航、脚本等非内容元素
4. 为每个段落生成：
   - XPath路径
   - CFI Range（使用 `epubcfi` 库）
   - 原始文本
   - 空段落标记

---

### 4. 位置标识与高亮

#### CFI Range 生成

```typescript
import EpubCFI from 'epubcfi'
import { JSDOM } from 'jsdom'

// 在Main进程中生成CFI
function generateCFIRange(xhtmlPath: string, xpath: string): string {
  const html = fs.readFileSync(xhtmlPath, 'utf-8')
  const dom = new JSDOM(html)
  const element = dom.window.document.evaluate(
    xpath,
    dom.window.document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue

  const range = dom.window.document.createRange()
  range.selectNodeContents(element)

  const cfi = new EpubCFI()
  return cfi.generateCfiFromRange(range, dom.window.document)
}
```

#### 高亮实现

**阅读界面高亮**（epub.js annotations）:
```typescript
// 添加高亮
rendition.annotations.highlight(
  cfiRange,
  { segmentId: 'segment-123' },
  () => {},
  'segment-highlight'  // CSS类名
)

// 移除高亮
rendition.annotations.remove(cfiRange, 'highlight')
```

**右侧栏高亮**（直接CSS）:
```typescript
// Hover状态管理
const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null)

// 卡片样式
<div
  className={`segment-card ${hoveredSegmentId === segment.id ? 'highlighted' : ''}`}
  onMouseEnter={() => setHoveredSegmentId(segment.id)}
  onMouseLeave={() => setHoveredSegmentId(null)}
>
```

---

### 5. 手动分割功能

#### 选区捕获

```typescript
// 监听阅读界面的文本选择
useEffect(() => {
  const handleSelection = () => {
    const selection = rendition.getContents()[0].window.getSelection()
    if (selection && !selection.isCollapsed) {
      const range = selection.getRangeAt(0)
      const cfi = new EpubCFI()
      const cfiRange = cfi.generateCfiFromRange(range, rendition.getContents()[0].document)

      // 显示Context Menu
      showContextMenu({
        position: { x: event.clientX, y: event.clientY },
        cfiRange,
        selectedText: selection.toString()
      })
    }
  }

  rendition.on('selected', handleSelection)
}, [rendition])
```

#### Context Menu 样式

参考iOS风格：
- 深色背景 (`bg-gray-800`)
- 圆角 (`rounded-lg`)
- 阴影 (`shadow-lg`)
- 小箭头指向选中位置
- 点击外部自动关闭

```tsx
<div className="absolute z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
  </div>
  <button onClick={handleSplit}>分割</button>
</div>
```

#### 分割逻辑

```typescript
function splitSegment(parentSegmentId: string, cfiRange: string): Segment[] {
  // 1. 找到父分段
  const parent = segments.find(s => s.id === parentSegmentId)

  // 2. 解析CFI，确定分割位置
  const splitPosition = parseCFIPosition(cfiRange)

  // 3. 拆分文本
  const parts = splitTextByCFI(parent.originalText, splitPosition)

  // 4. 生成新分段（一分为二或一分为三）
  return parts.map((text, index) => ({
    id: generateId(),
    ...parent,
    originalText: text,
    parentSegmentId: parent.id,
    position: parent.position + index * 0.1  // 保持顺序
  }))
}
```

---

### 6. 分割动画

#### 动画效果

原分段卡片向下展开，中间插入新分段：

```
[原分段]
    ↓ 展开动画
[分段1]  ← 原位置
[分段2]  ← 展开插入
[分段3]  ← 展开插入
```

#### 实现方案

使用 **Ant Design + CSS Transition**:

```tsx
import { List } from 'antd'
import { CSSTransition, TransitionGroup } from 'react-transition-group'

<TransitionGroup>
  {segments.map(segment => (
    <CSSTransition
      key={segment.id}
      timeout={300}
      classNames="segment"
    >
      <List.Item>
        {/* 段落卡片 */}
      </List.Item>
    </CSSTransition>
  ))}
</TransitionGroup>
```

```css
.segment-enter {
  opacity: 0;
  max-height: 0;
  transform: scaleY(0);
}

.segment-enter-active {
  opacity: 1;
  max-height: 500px;
  transform: scaleY(1);
  transition: all 300ms ease-out;
}

.segment-exit {
  opacity: 1;
  max-height: 500px;
}

.segment-exit-active {
  opacity: 0;
  max-height: 0;
  transition: all 200ms ease-in;
}
```

---

## 🗂️ 新增依赖

```json
{
  "dependencies": {
    "adm-zip": "^0.5.10",
    "better-sqlite3": "^9.2.2",
    "epubcfi": "^0.3.0",
    "jsdom": "^23.2.0",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/adm-zip": "^0.5.5",
    "@types/better-sqlite3": "^7.6.8",
    "@types/jsdom": "^21.1.6",
    "@types/uuid": "^9.0.7"
  }
}
```

---

## 📦 新增文件结构

```
src/
├── components/
│   ├── SegmentList.tsx              # 右侧栏分段列表
│   ├── SegmentCard.tsx              # 单个分段卡片
│   ├── ContextMenu.tsx              # 手动分割菜单
│   └── TranslationPanel.tsx (修改)  # 集成分段功能
│
├── services/
│   ├── projectService.ts            # 项目管理（Main进程）
│   ├── segmentService.ts            # 分段解析（Main进程）
│   └── databaseService.ts           # SQLite操作（Main进程）
│
├── store/
│   ├── projectStore.ts              # 项目状态（新增）
│   └── segmentStore.ts              # 分段状态（新增）
│
└── types/
    ├── project.d.ts                 # 项目类型定义
    └── segment.d.ts                 # 分段类型定义
```

---

## 🔄 实现步骤

### Step 1: 基础架构
- [ ] 安装依赖
- [ ] 创建数据库表结构
- [ ] 实现项目目录管理
- [ ] 实现EPUB解压功能

### Step 2: 分段核心
- [ ] 实现段落提取算法
- [ ] 实现CFI Range生成
- [ ] 创建分段数据结构
- [ ] 实现分段保存/加载

### Step 3: UI展示
- [ ] 右侧栏分段列表组件
- [ ] 段落卡片组件
- [ ] 双向高亮联动
- [ ] 接受/丢弃按钮

### Step 4: 手动分割
- [ ] 选区捕获
- [ ] Context Menu组件
- [ ] 分割逻辑实现
- [ ] 分割动画效果

### Step 5: 集成与优化
- [ ] 翻译模式切换时创建项目
- [ ] 关闭时修改检测
- [ ] 错误处理
- [ ] 性能优化

---

## ⚠️ 已知技术风险

### 1. CFI生成复杂度
- **风险**: epubcfi库在jsdom环境下可能表现异常
- **缓解**: 优先使用XPath，CFI作为辅助

### 2. iframe内选区捕获
- **风险**: epub.js的iframe可能限制selection事件
- **缓解**: 测试epub.js的`selected`事件，不行则改用overlay方案

### 3. 跨章节分段
- **风险**: 无目录时的三viewport内容可能不连续
- **缓解**: 明确告知用户分段范围，避免歧义

---

## 📝 注意事项

1. **空段落处理**: 数据中保留，UI中过滤显示
2. **段落完整性**: 分割时确保不截断句子（句号、问号、叹号结尾）
3. **性能优化**: 大量分段时使用虚拟滚动（react-window）
4. **错误恢复**: 分段失败时回退到初始状态，不影响阅读
5. **数据一致性**: 使用SQLite事务确保数据完整性

---

*文档版本: v1.0*
*创建时间: 2025-01-22*
*状态: 待实施*
