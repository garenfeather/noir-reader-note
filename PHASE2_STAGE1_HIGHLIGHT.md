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

### 1. 定位方式：CFI + XPath 组合

**数据结构：**
- 分段数据（segments 表）中包含：
  - `xpath` 字段：元素定位路径
  - `cfi_range` 字段：EPUB CFI 范围（用于跨页跳转）

**定位策略：**

| 场景 | 使用的定位方式 | 说明 |
|------|---------------|------|
| 悬停高亮 | XPath | 仅当前页面有效，无需跨页 |
| 点击跳转 | CFI → XPath | CFI 跨页跳转，XPath 精确定位 |

**点击跳转的完整流程：**
```
1. 从 segment 获取 cfiRange
2. 调用 rendition.display(cfiRange) 跳转到目标页面
3. 监听 relocated 事件，等待页面渲染完成
4. 使用 XPath 在新页面的 DOM 中精确定位元素
5. 滚动到元素位置 + 闪烁高亮
```

**悬停高亮的流程：**
```
1. 从 segment 获取 xpath
2. 通过 rendition.getContents()[0].document 获取当前页面的 DOM
3. 使用 document.evaluate() 执行 XPath 查询
4. 如果找到元素，添加高亮；找不到则静默失败
```

**已知限制：**
- XPath 在 epub.js 的 iframe 中可能与原始 XHTML 的 DOM 结构不完全一致
- CFI 生成可能在某些特殊元素上失败（降级为仅 XPath，不支持跨页）
- 需要在实际测试中验证可行性

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

### 4. 跨页跳转支持

**epub.js 的分页机制：**
- 内容按页渲染，当前只有一页或两页在 DOM 中
- 其他页面的元素不存在于 DOM

**跨页跳转的实现：**
- 同一章节内可能跨多页（例如用户在第 1 章第 1 页，点击第 1 章第 5 页的附注）
- **解决方案**：使用 CFI（Canonical Fragment Identifier）
  1. 调用 `rendition.display(cfiRange)` 跳转到目标页面
  2. 等待 `relocated` 事件触发（页面渲染完成）
  3. 使用 XPath 精确定位元素
  4. 滚动和高亮

**不会遇到的情况：**
- **跨章节跳转**：附注功能保证只在对应章节实现
- 用户在第 N 章时，右侧栏只显示第 N 章的附注
- 不会出现点击第 5 章附注但用户在第 1 章的情况

**降级处理：**
- 如果 CFI 生成失败（segment.cfiRange 为 null）：
  - 仅支持当前页面内的 XPath 定位
  - 如果元素不在当前页面，跳转失败
  - 控制台输出警告日志
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

### 6. CFI 生成方案

**生成时机：**
- 用户点击"接受"按钮时，在保存到数据库之前生成
- **不在初始分割时生成**（节省计算资源，避免浪费）

**生成位置：**
- Main 进程（Node.js 环境）
- 在 `services/segment.js` 或 `services/database.js` 中

**技术依赖：**
- 安装 `epubcfi` 包：`npm install epubcfi@^0.3.0`
- 使用 `jsdom` 解析 XHTML（已安装）

**生成流程：**
```
用户点击"接受"
  ↓
前端调用 window.electronAPI.saveSegments(projectId, segments)
  ↓
Main 进程处理：
  1. 遍历 segments 数组
  2. 对每个 segment：
     a. 根据 projectId 获取项目解压路径
     b. 根据 chapterHref 找到对应的 XHTML 文件
     c. 使用 jsdom 解析 XHTML 为 DOM
     d. 使用 xpath 在 DOM 中定位元素
     e. 创建 Range 对象包裹元素内容
     f. 调用 epubcfi 生成 CFI Range
     g. 更新 segment.cfiRange
  3. 保存所有 segments 到数据库（包含生成的 cfiRange）
```

**核心代码逻辑：**

**新增方法 `generateCFI(element, document)`：**
- 输入：段落 DOM 元素 + document 对象
- 输出：CFI Range 字符串或 null
- 实现步骤：
  1. 创建 Range：`document.createRange()`
  2. 选择内容：`range.selectNodeContents(element)`
  3. 生成 CFI：`new EpubCFI().generateCfiFromRange(range, document)`
  4. 异常处理：如果失败返回 null

**修改 `saveSegments` 方法：**
- 在保存前，对每个 segment 调用 CFI 生成逻辑
- 伪代码：
```javascript
async function saveSegments(projectId, segments) {
  // 1. 获取项目路径
  const projectInfo = getProject(projectId)
  const extractedPath = projectInfo.extractedPath

  // 2. 按章节分组（避免重复加载 XHTML）
  const segmentsByChapter = groupBy(segments, 'chapterHref')

  // 3. 遍历每个章节
  for (const [chapterHref, chapterSegments] of segmentsByChapter) {
    // 加载 XHTML 文件
    const xhtmlPath = path.join(extractedPath, chapterHref)
    const html = fs.readFileSync(xhtmlPath, 'utf-8')
    const dom = new JSDOM(html, { contentType: 'text/html' })
    const document = dom.window.document

    // 遍历该章节的所有 segments
    for (const segment of chapterSegments) {
      try {
        // 通过 XPath 找到元素
        const element = getElementByXPath(document, segment.xpath)
        if (element) {
          // 生成 CFI
          const cfiRange = generateCFI(element, document)
          segment.cfiRange = cfiRange
        } else {
          console.warn('未找到元素，无法生成 CFI:', segment.xpath)
          segment.cfiRange = null
        }
      } catch (error) {
        console.error('生成 CFI 失败:', error)
        segment.cfiRange = null
      }
    }
  }

  // 4. 保存到数据库
  saveToDB(segments)
}
```

**错误处理：**
- CFI 生成失败时设置为 `null`
- 记录警告日志但不中断保存流程
- 前端使用时检查 `cfiRange` 是否存在，决定是否支持跨页跳转

**性能考虑：**
- 按章节分组，避免重复加载同一个 XHTML 文件
- 通常一个章节几百个段落，生成耗时 < 1 秒
- 用户点击"接受"时才生成，不影响初始分割速度

---

## 📂 文件修改计划

### 需要修改/新建的文件

#### 前端文件

| 文件路径 | 操作 | 修改内容概述 |
|---------|------|-------------|
| `src/utils/highlightHelper.ts` | 🆕 新建 | XPath 查找、高亮添加/移除、滚动跳转等工具函数 |
| `src/components/SegmentList.tsx` | ✏️ 修改 | 添加 hover 监听逻辑 + 点击处理逻辑（支持 CFI 跳转） |
| `src/components/SegmentCard.tsx` | ✏️ 修改 | 移除 `isPressed` prop（不需要） |
| `src/index.css` | ✏️ 修改 | 添加两种高亮的 CSS 样式和动画 |

#### 后端文件（CFI 生成相关）

| 文件路径 | 操作 | 修改内容概述 |
|---------|------|-------------|
| `package.json` | ✏️ 修改 | 添加 `epubcfi` 依赖 |
| `services/segment.js` | ✏️ 修改 | 新增 `generateCFI` 方法 |
| `services/database.js` | ✏️ 修改 | 修改 `saveSegments` 方法，保存前生成 CFI |

### 不需要修改的文件

| 文件路径 | 说明 |
|---------|------|
| `src/store/segmentStore.ts` | 现有的 `hoveredSegmentId` 状态已满足需求 |
| `src/components/ContentViewer.tsx` | 阶段一不涉及阅读界面的事件监听 |
| `src/components/TranslationPanel.tsx` | 不需要改动 |
| `services/project.js` | 不需要改动 |
| `src/types/segment.d.ts` | `cfiRange` 字段已定义 |

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

**点击处理函数的 CFI 跳转逻辑：**
- 检查 `segment.cfiRange` 是否存在
- **如果有 CFI**：
  1. 调用 `rendition.display(segment.cfiRange)` 跳转页面
  2. 监听 `relocated` 事件（一次性监听器）
  3. 在 relocated 回调中：
     - 通过 XPath 查找元素
     - 滚动 + 闪烁高亮
- **如果没有 CFI**（降级）：
  1. 直接通过 XPath 查找元素
  2. 如果找到：滚动 + 闪烁高亮
  3. 如果未找到：输出警告日志（可能不在当前页面）

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

### 5. 修改 `package.json`

**添加依赖：**
- 在 `dependencies` 中添加：`"epubcfi": "^0.3.0"`
- 安装命令：`npm install epubcfi@^0.3.0`

---

### 6. 修改 `services/segment.js`

**新增导入：**
- 在文件顶部添加：`const EpubCFI = require('epubcfi')`

**新增方法 `generateCFI(element, document)`：**

功能：为 DOM 元素生成 CFI Range

参数：
- `element`: 段落元素（从 XPath 查找得到）
- `document`: jsdom 的 document 对象

返回值：
- 成功：CFI Range 字符串（例如 `epubcfi(/6/4!/4/2/2)`）
- 失败：`null`

实现逻辑：
1. 创建 Range 对象
2. 使用 `range.selectNodeContents(element)` 选择元素内容
3. 调用 `new EpubCFI().generateCfiFromRange(range, document)` 生成 CFI
4. try-catch 包裹，失败时返回 null 并记录警告

注意事项：
- 使用 `jsdom` 的 Range API：`document.createRange()`
- epubcfi 库在 jsdom 环境下可能异常，需要捕获错误

---

### 7. 修改 `services/database.js`

**修改 `saveSegments` 方法：**

当前逻辑：
- 直接保存 segments 数组到数据库

修改后逻辑：
1. **在保存前生成 CFI**
2. 按章节分组 segments（避免重复加载 XHTML）
3. 对每个章节：
   - 根据 `projectId` 和 `chapterHref` 构建 XHTML 文件路径
   - 使用 `fs.readFileSync` 读取文件
   - 使用 `jsdom` 解析为 DOM
   - 遍历该章节的所有 segments：
     - 调用 `segmentService.getElementByXPath()` 定位元素
     - 调用 `segmentService.generateCFI()` 生成 CFI
     - 更新 `segment.cfiRange`
4. 保存到数据库

需要的辅助方法：
- 从 `projectService` 获取项目解压路径
- 从 `segmentService` 调用 `getElementByXPath` 和 `generateCFI`

错误处理：
- CFI 生成失败时，`segment.cfiRange` 设为 `null`
- 记录警告日志：`console.warn('生成 CFI 失败:', segment.id, error)`
- 不中断保存流程

性能优化：
- 按章节分组，同一章节只加载一次 XHTML
- 使用 `Array.reduce()` 或手动分组

日志输出：
- 保存开始：`console.log('开始保存 segments，共 X 个')`
- 生成 CFI 统计：`console.log('CFI 生成成功: X 个，失败: Y 个')`
- 保存完成：`console.log('保存完成')`

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

### 测试场景 6：CFI 生成验证
1. 分割某个章节
2. 点击"接受"按钮
3. **预期**：
   - 控制台输出 CFI 生成统计（成功 X 个，失败 Y 个）
   - 保存成功提示
4. 在数据库中查询：`SELECT id, xpath, cfi_range FROM segments LIMIT 10`
5. **预期**：`cfi_range` 字段有值（不是全部为 null）

### 测试场景 7：跨页跳转测试
1. 打开一个长章节（确保有多页）
2. 在第 1 页，点击第 3 页的附注卡片
3. **预期**：
   - 阅读界面自动翻到第 3 页
   - 滚动到对应段落
   - 段落闪烁高亮
4. 观察控制台是否有错误

### 测试场景 8：CFI 降级测试
1. 手动修改数据库，将某些 segments 的 `cfi_range` 设为 `null`
2. 点击这些附注卡片
3. **预期**：
   - 如果在当前页面：正常跳转和高亮
   - 如果不在当前页面：控制台警告，详情页正常打开

---

## ⚠️ 已知限制

### 1. XPath 定位可能失效
- **原因**：epub.js 渲染后的 DOM 结构可能与原始 XHTML 不一致
- **影响**：部分段落无法通过 XPath 精确定位
- **应对**：先实现并测试，如果普遍失效再考虑其他方案（如 data-segment-id）
- **缓解**：有 CFI 的情况下，可以先跳转到正确页面，降低失效概率

### 2. CFI 生成可能失败
- **原因**：epubcfi 库在 jsdom 环境下可能不稳定，部分元素结构复杂
- **影响**：部分段落的 `cfi_range` 为 null，不支持跨页跳转
- **应对**：降级为仅 XPath 定位（当前页面有效）
- **缓解**：try-catch 包裹，不影响保存流程

### 3. 跨页跳转的精确度
- **原因**：CFI 跳转后，XPath 仍可能失效
- **影响**：跳转到目标页面，但无法精确滚动和高亮
- **应对**：先实现并测试，观察实际效果

### 4. iframe 动态变化
- **原因**：epub.js 翻页时会重新渲染 iframe
- **影响**：翻页后需要重新获取 document
- **应对**：每次操作都实时获取 `rendition.getContents()[0].document`

### 5. 悬停高亮不支持跨页
- **原因**：悬停时不触发页面跳转（避免影响阅读）
- **影响**：鼠标悬停非当前页面的附注时，高亮无效
- **应对**：接受此限制，用户体验可接受

---

## 📊 实现优先级

### P0 - 必须实现（阶段一核心功能）

**后端部分：**
- ✅ 安装 `epubcfi` 依赖
- ✅ 实现 `generateCFI` 方法（services/segment.js）
- ✅ 修改 `saveSegments` 方法，保存前生成 CFI（services/database.js）

**前端部分：**
- ✅ XPath 查找工具函数（highlightHelper.ts）
- ✅ 悬停高亮功能（SegmentList.tsx）
- ✅ 点击跳转和闪烁高亮（SegmentList.tsx，支持 CFI 跨页）
- ✅ 错误日志输出（highlightHelper.ts）
- ✅ CSS 样式和动画（index.css）

### P1 - 重要但可延后
- 🔄 XPath 失效的降级方案（根据测试结果决定）
- 🔄 CFI 生成失败率优化（根据测试结果决定）
- 🔄 详情页返回后的滚动位置保持
- 🔄 跨页跳转的用户体验优化（加载动画等）

### P2 - 未来优化
- 💡 使用 data-segment-id 替代 XPath（如果 XPath 普遍失效）
- 💡 高亮效果的自定义配置（颜色、动画时长等）
- 💡 性能优化：CFI 缓存机制
- 💡 为已有数据批量生成 CFI（迁移脚本）

---

## 📝 后续工作（阶段二）

阶段二将实现：
- 阅读界面长按检测
- 阅读界面 → 右侧栏的反向高亮联动
- 需要在 `ContentViewer.tsx` 中添加事件监听

---

## 📌 实施流程

**推荐的实施顺序：**

1. **后端先行**（安装依赖 + CFI 生成）
   - 安装 `epubcfi` 包
   - 实现 `generateCFI` 方法
   - 修改 `saveSegments` 方法
   - 测试 CFI 生成是否正常

2. **前端工具函数**（高亮辅助）
   - 创建 `highlightHelper.ts`
   - 实现所有工具函数
   - 单独测试 XPath 查找

3. **前端 UI 交互**（悬停 + 点击）
   - 修改 `SegmentList.tsx`（核心逻辑）
   - 修改 `SegmentCard.tsx`（移除 prop）
   - 添加 CSS 样式

4. **集成测试**
   - 按照测试计划逐个验证
   - 记录 XPath 和 CFI 的成功率
   - 根据实际情况调整策略

---

*文档版本: v2.0*
*创建时间: 2025-01-23*
*最后更新: 2025-01-23*
*更新内容: 添加 CFI 生成方案（在点击"接受"时生成）*
*状态: 待实施*
