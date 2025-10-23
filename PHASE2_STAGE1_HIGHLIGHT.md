# Phase 2 阶段一实现计划 - 双向高亮功能

## 📋 需求概述

实现附注功能的双向高亮联动（仅阶段一）：
- 鼠标悬停右侧栏附注卡片 → 阅读界面对应段落**持续高亮**
- 点击右侧栏附注卡片 → 进入详情页 + 阅读界面跳转 + **短暂闪烁高亮**

---

## 🎯 功能目标

### 1. 悬停高亮（Hover Highlight）
- **触发条件**：鼠标移入右侧栏的附注卡片
- **效果**：阅读界面对应段落显示浅色背景高亮
- **持续时间**：鼠标移出后立即消失
- **适用范围**：仅当前页面内的段落（不跨页）

### 2. 点击跳转 + 闪烁高亮（Click Jump & Flash）
- **触发条件**：点击右侧栏的附注卡片
- **效果**：
  1. 右侧栏进入附注详情页
  2. 阅读界面滚动到对应段落位置
  3. 对应段落短暂闪烁高亮（1.5秒后自动消失）
- **适用模式**：编辑模式和只读模式行为一致
- **适用范围**：仅当前页面内的段落（不跨页）

### 3. 错误处理
- **找不到元素时**：仅在控制台输出详细错误日志
- **不影响功能**：详情页正常打开，仅跳转和高亮失效

---

## 🔍 技术方案说明

### 1. 定位方式：XPath

**当前数据结构：**
- 分段数据（segments 表）中包含 `xpath` 字段
- XPath 是基于原始 XHTML 文件生成的元素路径
- **不依赖 CFI**（暂不生成 CFI Range）

**定位流程：**
```
1. 从 segment 获取 xpath
2. 通过 rendition.getContents()[0].document 获取当前页面的 DOM
3. 使用 document.evaluate() 执行 XPath 查询
4. 返回对应的 DOM 元素
```

**已知限制：**
- XPath 在 epub.js 的 iframe 中可能与原始 XHTML 的 DOM 结构不完全一致
- 需要在实际测试中验证可行性
- 如果普遍失效，后续考虑其他方案（data-segment-id 或 CFI）

---

### 2. 高亮实现方式

**方案：CSS 类名控制**

不使用 epub.js 的 `annotations.highlight()` API，原因：
- annotations API 需要 CFI Range
- 当前仅有 XPath，没有 CFI
- 直接操作 DOM 添加/移除 CSS 类更简单直接

**两种高亮样式：**

| 类型 | CSS 类名 | 触发条件 | 效果 | 消失方式 |
|------|----------|----------|------|----------|
| 悬停高亮 | `.segment-hover-highlight` | hover 卡片 | 浅蓝色背景 | 鼠标移出时移除类名 |
| 闪烁高亮 | `.segment-flash-highlight` | 点击卡片 | 深蓝色背景 + 阴影 + 动画 | CSS Animation 自动淡出 |

**闪烁高亮的实现细节：**
- 使用 CSS `@keyframes` 定义淡出动画
- `animation-duration: 1.5s`
- 监听 `animationend` 事件，动画结束后移除类名
- 完全自动化，无需手动管理 setTimeout

---

### 3. 冲突处理策略

**问题：**
- 同一个阅读界面元素可能同时需要两种高亮
- 例如：用户 hover 卡片 A → 点击卡片 A

**解决方案：**
- 点击时先调用 `setHoveredSegment(null)` 清除 hover 状态
- 移除 `.segment-hover-highlight` 类
- 再添加 `.segment-flash-highlight` 类
- 确保闪烁高亮不受 hover 高亮干扰

**用户体验流程：**
```
鼠标移到卡片 A 上
  → 阅读界面段落 A 持续高亮（浅蓝）

鼠标点击卡片 A
  → hover 高亮立即消失
  → 进入详情页
  → 阅读界面跳转到段落 A
  → 段落 A 闪烁高亮 1.5s（深蓝 + 阴影）
  → 闪烁消失
```

---

### 4. 跨页跳转问题

**epub.js 的分页机制：**
- 内容按页渲染，当前只有一页或两页在 DOM 中
- 其他页面的元素不存在于 DOM

**当前方案的限制：**
- 仅支持当前页面内的段落跳转
- 如果目标段落在其他页面，XPath 无法找到元素

**为什么不会遇到跨页问题：**
- **已确认**：附注功能保证了只在对应章节实现
- 用户在第 N 章时，右侧栏只显示第 N 章的附注
- 不会出现点击第 5 章附注但用户在第 1 章的情况

**降级处理（预防性）：**
- 如果仍然找不到元素（可能是 XPath 失效）
- 控制台输出详细错误日志
- 详情页正常打开，仅跳转和高亮失效

---

### 5. 错误日志设计

**输出时机：**
- XPath 在 iframe 中找不到元素时

**日志内容：**
```
❌ XPath 定位失败
  XPath: //body/div[2]/p[3]
  章节ID: chapter-001
  章节Href: OEBPS/chapter01.xhtml
  Rendition 状态: 已加载
  iframe Document: 存在
  可能原因:
    1. XPath 与 iframe DOM 结构不匹配
    2. 元素不在当前页面（已排除）
  建议: 检查 XPath 生成逻辑或考虑使用 CFI
```

**实现方式：**
- 使用 `console.group()` 分组输出
- 使用 `console.error()` 确保显眼
- 输出所有关键调试信息

---

## 📂 文件修改计划

### 需要修改/新建的文件

| 文件路径 | 操作 | 修改内容概述 |
|---------|------|-------------|
| `src/utils/highlightHelper.ts` | 🆕 新建 | XPath 查找、高亮添加/移除、滚动跳转等工具函数 |
| `src/components/SegmentList.tsx` | ✏️ 修改 | 添加 hover 监听逻辑 + 点击处理逻辑 |
| `src/components/SegmentCard.tsx` | ✏️ 修改 | 移除 `isPressed` prop（不需要） |
| `src/index.css` | ✏️ 修改 | 添加两种高亮的 CSS 样式和动画 |

### 不需要修改的文件

| 文件路径 | 说明 |
|---------|------|
| `src/store/segmentStore.ts` | 现有的 `hoveredSegmentId` 状态已满足需求 |
| `src/components/ContentViewer.tsx` | 阶段一不涉及阅读界面的事件监听 |
| `src/components/TranslationPanel.tsx` | 不需要改动 |

---

## 🔧 详细修改计划

### 1. 新建 `src/utils/highlightHelper.ts`

**功能：提供高亮和定位相关的工具函数**

**需要实现的函数：**

#### `findElementByXPath(xpath: string, doc: Document): Element | null`
- 在给定的 Document 中通过 XPath 查找元素
- 使用 `document.evaluate()` API
- 返回匹配的第一个元素，未找到返回 null
- 捕获异常并记录错误

#### `findElementInRendition(xpath: string, rendition: Rendition | null): Element | null`
- 在 epub.js 的 rendition 中查找元素
- 获取 `rendition.getContents()[0].document`
- 调用 `findElementByXPath`
- 添加空值检查（rendition、contents、document）
- 找不到元素时输出详细错误日志

#### `addHighlight(element: Element, className: string): void`
- 给元素添加高亮 CSS 类
- 使用 `element.classList.add(className)`

#### `removeHighlight(element: Element, className: string): void`
- 移除元素的高亮 CSS 类
- 使用 `element.classList.remove(className)`

#### `addFlashHighlight(element: Element): void`
- 添加闪烁高亮效果
- 添加 `.segment-flash-highlight` 类名
- 监听 `animationend` 事件
- 动画结束后自动移除类名

#### `scrollToElement(element: Element): void`
- 滚动到元素位置
- 使用 `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`

---

### 2. 修改 `src/components/SegmentList.tsx`

**新增导入：**
- 从 `useBookStore` 导入 `rendition`
- 导入 `highlightHelper` 中的工具函数

**新增 Ref：**
- `currentHighlightedElement` - 保存当前高亮的元素引用
- 用于在移除高亮时访问

**新增 useEffect - 监听 hoveredSegmentId：**
- 依赖项：`[hoveredSegmentId, visibleSegments, rendition]`
- 逻辑：
  1. 如果有之前的高亮元素，移除 `.segment-hover-highlight` 类
  2. 如果 `hoveredSegmentId` 不为 null：
     - 找到对应的 segment
     - 通过 XPath 在 rendition 中查找元素
     - 如果找到，添加 `.segment-hover-highlight` 类
     - 保存元素引用到 ref
  3. 返回清理函数：移除高亮

**修改点击处理函数 `handleCardClick`：**
- 接收 `segment` 参数
- 执行顺序：
  1. `setHoveredSegment(null)` - 清除 hover 状态
  2. `setSelectedSegment(segment.id)` - 进入详情页
  3. `requestAnimationFrame(() => { ... })` - 异步执行跳转和闪烁
     - 通过 XPath 查找元素
     - 如果找到：`scrollToElement()` + `addFlashHighlight()`
     - 如果未找到：输出错误日志

**修改 SegmentCard 调用：**
- `onClick` 传递 `() => handleCardClick(segment)`

---

### 3. 修改 `src/components/SegmentCard.tsx`

**修改 Props 接口：**
- 移除 `isPressed: boolean`（阶段一不需要）

**修改样式逻辑：**
- 仅根据 `isHovered` 判断样式
- `isHovered === true` → 蓝色背景 + 边框 + 阴影
- `isHovered === false` → 白色背景 + 默认边框

---

### 4. 修改 `src/index.css`

**添加悬停高亮样式：**
```css
.segment-hover-highlight {
  background-color: rgba(59, 130, 246, 0.15) !important;
  transition: background-color 0.2s ease;
  border-radius: 2px;
}
```

**添加闪烁高亮样式和动画：**
```css
.segment-flash-highlight {
  animation: flashHighlight 1.5s ease-out forwards;
}

@keyframes flashHighlight {
  0% {
    background-color: rgba(59, 130, 246, 0.4);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
  }
  100% {
    background-color: transparent;
    box-shadow: 0 0 0 0 transparent;
  }
}
```

**说明：**
- `forwards` 保持动画结束状态
- 通过 `animationend` 事件在 JavaScript 中移除类名
- 动画时长 1.5 秒

---

## 🧪 测试计划

### 测试场景 1：悬停高亮
1. 打开一个 EPUB 文件，进入某个章节
2. 在右侧栏悬停鼠标到某个附注卡片上
3. **预期**：阅读界面对应段落显示浅色高亮背景
4. 移出鼠标
5. **预期**：高亮立即消失

### 测试场景 2：点击跳转和闪烁
1. 点击右侧栏的某个附注卡片
2. **预期**：
   - 右侧栏切换到详情页
   - 阅读界面滚动到对应段落
   - 段落显示闪烁高亮（深蓝色 + 阴影）
   - 1.5 秒后高亮自动消失

### 测试场景 3：hover 后点击
1. 鼠标悬停到附注卡片 A
2. **预期**：阅读界面段落 A 持续高亮
3. 点击卡片 A
4. **预期**：
   - 持续高亮立即消失
   - 进入详情页 + 跳转 + 闪烁高亮

### 测试场景 4：XPath 定位失效
1. 在控制台观察是否有 "XPath 定位失败" 的错误日志
2. 如果有，检查：
   - 错误日志是否包含完整的调试信息
   - 详情页是否仍然正常打开
   - 是否仅跳转和高亮失效

### 测试场景 5：翻页后重新测试
1. 在阅读界面翻页
2. 重复测试场景 1 和 2
3. **预期**：功能正常（验证 iframe 变化后仍然有效）

---

## ⚠️ 已知限制

### 1. XPath 定位可能失效
- **原因**：epub.js 渲染后的 DOM 结构可能与原始 XHTML 不一致
- **影响**：部分或全部段落无法高亮和跳转
- **应对**：先实现并测试，如果普遍失效再考虑其他方案

### 2. 仅支持当前页面内的段落
- **原因**：没有 CFI 无法实现跨页跳转
- **影响**：理论上无影响（已确认附注仅在对应章节）
- **应对**：如果后续需要跨章节附注，需要生成 CFI

### 3. iframe 动态变化
- **原因**：epub.js 翻页时会重新渲染 iframe
- **影响**：翻页后需要重新获取 document
- **应对**：每次操作都实时获取 `rendition.getContents()[0].document`

---

## 📊 实现优先级

### P0 - 必须实现
- ✅ XPath 查找工具函数
- ✅ 悬停高亮功能
- ✅ 点击跳转和闪烁高亮
- ✅ 错误日志输出

### P1 - 重要但可延后
- 🔄 XPath 失效的降级方案（根据测试结果决定）
- 🔄 详情页返回后的滚动位置保持

### P2 - 未来优化
- 💡 生成 CFI 支持跨页跳转
- 💡 使用 data-segment-id 替代 XPath
- 💡 高亮效果的自定义配置

---

## 📝 后续工作（阶段二）

阶段二将实现：
- 阅读界面长按检测
- 阅读界面 → 右侧栏的反向高亮联动
- 需要在 `ContentViewer.tsx` 中添加事件监听

---

*文档版本: v1.0*
*创建时间: 2025-01-23*
*状态: 待实施*
