# 书签功能设计方案

## 需求概述

在附注功能基础上，新增书签功能，允许用户收藏附注以便快速定位和回顾重要内容。

## 核心需求

1. **数据模型**：书签是附注的引用，仅保留关联数据，附注删除后书签自动消失
2. **原文加载**：不保存原文，动态加载
3. **UI交互**：下拉菜单悬停展开"附注/书签"选项
4. **状态保持**：切换视图时各自保留滚动位置和选中状态
5. **收藏权限**：只能在只读模式下收藏
6. **删除方式**：书签列表悬停时右上角显示删除按钮
7. **防重复**：同一附注不可多次收藏，按钮显示"已收藏"状态
8. **列表组织**：按章节顺序分组显示，详情页显示章节名
9. **编辑权限**：书签完全只读
10. **跨章跳转**：直接通过 CFI 跳转

---

## 1. 数据库设计

### 表结构

```sql
CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_bookmarks_segment ON bookmarks(segment_id);
CREATE INDEX idx_bookmarks_created ON bookmarks(created_at);
```

### 数据关系

- 一个附注最多对应一个书签（唯一索引）
- 附注删除时级联删除书签（ON DELETE CASCADE）
- 书签通过 JOIN segments 获取所有数据

### 查询逻辑

```sql
-- 获取书签列表
SELECT
  b.id as bookmark_id,
  b.created_at as bookmarked_at,
  s.*
FROM bookmarks b
INNER JOIN segments s ON b.segment_id = s.id
ORDER BY s.chapter_index, s.start_cfi;

-- 检查是否已收藏
SELECT id FROM bookmarks WHERE segment_id = ?;
```

---

## 2. API 设计

### electron.js 新增方法

- `addBookmark(segmentId)` - 添加书签
- `removeBookmark(segmentId)` - 删除书签
- `getBookmarks()` - 获取书签列表（JOIN segments表）
- `isBookmarked(segmentId)` - 检查是否已收藏

### preload.js 暴露接口

在 `window.electronAPI` 中添加：
- `addBookmark`
- `removeBookmark`
- `getBookmarks`
- `isBookmarked`

---

## 3. 状态管理

### bookmarkStore 状态

- `bookmarks` - 书签列表（包含segment完整信息）
- `bookmarkedSegmentIds` - Set类型，快速查找是否已收藏
- `selectedBookmarkId` - 当前选中的书签
- `bookmarkScrollTop` - 书签列表滚动位置
- `isLoading` - 加载状态

### bookmarkStore Actions

- `loadBookmarks()` - 加载书签列表
- `addBookmark(segmentId)` - 添加书签
- `removeBookmark(segmentId)` - 删除书签
- `isBookmarked(segmentId)` - 检查是否已收藏
- `selectBookmark(bookmarkId)` - 选中书签
- `saveScrollPosition(scrollTop)` - 保存滚动位置

### segmentStore 扩展

- 新增 `segmentScrollTop` 状态
- 新增 `saveScrollPosition(scrollTop)` 方法

---

## 4. 组件设计

### TranslationPanel 重构

**新增状态：**
- `viewMode: 'segments' | 'bookmarks'` - 视图模式
- `dropdownOpen: boolean` - 下拉菜单状态

**功能：**
- 顶部标题区域添加下拉菜单（Ant Design Dropdown，悬停触发）
- 视图切换时保存当前滚动位置，恢复新视图滚动位置
- 根据 viewMode 渲染 SegmentList 或 BookmarkList
- 只在附注视图显示编辑按钮

### BookmarkButton 组件

**位置：** 附注列表项和详情页
**显示条件：** 只读模式
**状态：**
- 未收藏：显示空星图标 + "收藏"
- 已收藏：显示实心星图标 + "已收藏"（禁用）
**交互：** 点击后调用 `addBookmark` API

### BookmarkList 组件

**功能：**
- 按章节分组显示
- 每组显示章节标题
- 书签项悬停时右上角显示删除按钮
- 点击书签项选中并进入详情页
- 点击删除按钮弹出确认（可选）后删除

**样式：**
- 与 SegmentList 保持一致
- 分组标题：小字号、灰色、背景色区分

### BookmarkDetail 组件

**功能：**
- 显示章节名称（小字号，带图标）
- 显示原文、译文、附注（完全只读）
- 显示收藏时间
- 添加"定位"按钮，点击跳转到原文位置

**特点：**
- 不可编辑任何内容
- 不显示任何编辑按钮
- 样式与 SegmentDetail 只读状态一致

---

## 5. 跨章跳转实现

### readerStore 扩展

新增 `jumpToCfi(cfi: string)` 方法：

1. 调用 `rendition.display(cfi)` 跳转（支持跨章）
2. 等待渲染完成（延迟 300ms）
3. 使用 `rendition.annotations.highlight()` 高亮目标文本
4. 使用 `scrollIntoView()` 滚动到屏幕中央
5. 错误处理：显示"定位失败"提示

---

## 6. 样式设计要点

### 下拉菜单样式

- 标题区域悬停时背景色变化
- 下拉图标（DownOutlined）居右
- 菜单项包含"附注"和"书签"

### 收藏按钮样式

- 默认隐藏，悬停附注项时显示
- 已收藏状态：金色星图标，不可点击
- 未收藏状态：灰色空心星图标

### 书签列表样式

- 章节分组标题：12px字号，灰色，浅色背景
- 书签项：与附注项样式一致
- 删除按钮：悬停时显示在右上角，红色危险按钮

### 书签详情样式

- 章节信息：小字号，带文件夹图标
- 只读内容：浅灰色背景，边框，不可编辑
- 收藏时间：底部小字号、灰色文字

---

## 7. 实施步骤

### Phase 1: 数据层（1-2天）

**任务：**
1. 在 `electron.js` 中添加 `bookmarks` 表创建逻辑
2. 实现 4 个 API 方法（add/remove/get/isBookmarked）
3. 在 `preload.js` 中暴露 IPC 接口
4. 在 `src/types.ts` 中定义类型

**验收标准：**
- 数据库正常创建表和索引
- API 调用返回正确数据
- 附注删除后书签自动消失

### Phase 2: 状态管理（1-2天）

**任务：**
1. 创建 `src/stores/bookmarkStore.ts`
2. 实现所有状态和 actions
3. 扩展 `segmentStore` 添加滚动位置状态
4. 测试状态同步

**验收标准：**
- bookmarkStore 正常工作
- 添加/删除书签后列表实时更新
- 切换视图时滚动位置保持

### Phase 3: UI 组件（3-4天）

**任务 3.1:** TranslationPanel 重构
- 添加 viewMode 状态
- 实现下拉菜单（Dropdown）
- 实现视图切换逻辑
- 保存/恢复滚动位置

**任务 3.2:** BookmarkButton 组件
- 创建组件并在 SegmentList/SegmentDetail 中集成
- 实现收藏/已收藏状态切换
- 添加点击事件处理

**任务 3.3:** BookmarkList 组件
- 实现按章节分组逻辑
- 实现悬停显示删除按钮
- 添加删除功能

**任务 3.4:** BookmarkDetail 组件
- 显示章节名称
- 显示只读内容
- 添加定位按钮

**验收标准：**
- 下拉菜单悬停自动展开
- 切换视图时状态保持
- 收藏按钮正确显示状态
- 书签列表按章节分组
- 详情页完全只读

### Phase 4: 跨章跳转（1天）

**任务：**
1. 在 `readerStore` 中添加 `jumpToCfi` 方法
2. 实现跨章跳转逻辑
3. 添加高亮和滚动
4. 测试跨章场景

**验收标准：**
- 点击"定位"按钮正确跳转
- 目标文本高亮显示
- 滚动到屏幕中央

### Phase 5: 样式优化（1天）

**任务：**
1. 实现所有样式
2. 调整间距、颜色、圆角
3. 添加过渡动画
4. 响应式适配

**验收标准：**
- 视觉效果符合设计
- 动画流畅无卡顿
- 各种状态样式正确

### Phase 6: 集成测试（1天）

**任务：**
1. 端到端测试完整流程
2. 测试边界情况
3. 性能测试

**验收标准：**
- 所有功能正常工作
- 无明显 bug
- 性能可接受

---

## 8. 技术风险和注意事项

### 风险点

1. **epub.js 跨章跳转**
   - 风险：部分 EPUB 文件可能不支持
   - 缓解：添加错误处理，显示友好提示

2. **滚动位置恢复**
   - 风险：列表内容变化时位置可能不准
   - 缓解：使用 `scrollTop` 像素值而非索引

3. **级联删除**
   - 风险：数据库外键约束可能失败
   - 缓解：手动测试外键功能，确保正确配置

### 性能优化

1. **bookmarkedSegmentIds 使用 Set**
   - 原因：O(1) 查找时间，避免数组遍历

2. **按需加载书签列表**
   - 首次打开书签视图时才调用 `loadBookmarks`

3. **防抖删除操作**
   - 避免用户快速点击多次触发多次删除

### 用户体验

1. **操作反馈**
   - 收藏成功后显示 Toast 提示
   - 删除前可选添加二次确认

2. **加载状态**
   - 列表加载时显示 Skeleton 或 Spin

3. **空状态**
   - 无书签时显示引导文案："点击附注旁的收藏按钮可添加书签"

---

## 9. 文件清单

### 需要修改的文件

| 文件路径 | 修改内容 |
|---------|---------|
| `electron.js` | 添加 bookmarks 表、实现 4 个 API 方法 |
| `preload.js` | 暴露书签相关 IPC 接口 |
| `src/types.ts` | 添加 Bookmark 类型定义 |
| `src/stores/segmentStore.ts` | 添加滚动位置状态 |
| `src/components/TranslationPanel.tsx` | 添加视图切换、下拉菜单 |
| `src/components/SegmentList.tsx` | 添加收藏按钮 |
| `src/components/SegmentDetail.tsx` | 添加收藏按钮 |

### 新增文件

- `src/stores/bookmarkStore.ts` - 书签状态管理
- `src/components/BookmarkButton.tsx` - 收藏按钮组件
- `src/components/BookmarkList.tsx` - 书签列表组件
- `src/components/BookmarkDetail.tsx` - 书签详情组件
- `src/styles/bookmarks.css` - 书签样式（可选）

---

## 10. 预计工作量

**总计：** 7-10 天（单人开发）

- Phase 1: 1-2天
- Phase 2: 1-2天
- Phase 3: 3-4天
- Phase 4: 1天
- Phase 5: 1天
- Phase 6: 1天
