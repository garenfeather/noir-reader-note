# 附注编辑功能设计方案

## 一、数据结构设计

### 1.1 Segment 表扩展字段

在现有 `segments` 表中新增以下字段：

```
originalText: string          // 原始文本（从EPUB提取，不可编辑）
translatedText?: string       // 译文（可编辑）
notes?: string[]              // 附注条目数组（自由字符串数组）
isModified: boolean           // 是否有修改
```

### 1.2 数据示例

```json
{
  "id": "seg-uuid-123",
  "projectId": "proj-456",
  "chapterId": "chapter-1",
  "position": 1,
  "originalText": "这是原始段落文本内容",
  "translatedText": "This is the translated text content",
  "notes": [
    "解释：段落 - 指文章中的一个自然段",
    "注意：这里的"原始"是相对于翻译而言的",
    "参考：第三章有相关说明"
  ],
  "isModified": true
}
```

### 1.3 翻译函数输出格式

```typescript
// 输入
sourceText: string

// 输出
{
  translatedText: string    // 译文
  notes: string[]           // 附注条目数组
}
```

### 1.4 临时实现（Mock）

在正式翻译API集成前：
- `translatedText` = `sourceText`（原文作为译文）
- `notes` = 从原文随机抽取几个词汇组成的字符串数组

---

## 二、段落编号与排序规则

### 2.1 position 字段的用途

**数据库层面：**
- `position` 字段**仅用于排序**
- 查询段落时使用 `ORDER BY position ASC`
- 删除段落时**不更新**其他段落的 position
- position 可能出现跳号（如：1, 2, 4, 5...）

**设计原因：**
- 简化删除逻辑，无需批量更新
- 为将来的手动拆分、插入功能预留空间（可用小数：2.5, 2.25 等）
- position 是技术属性，用户不直接看到

### 2.2 界面显示编号

**界面层面：**
- 显示的编号是**实时计算**的（数组索引 + 1）
- 始终保持**连续**（1, 2, 3, 4...）
- 删除段落后，后续编号自动递减

**实现方式：**
```typescript
// 数据库查询（按 position 排序）
const segments = await db.query(`
  SELECT * FROM segments
  WHERE chapter_id = ?
  ORDER BY position ASC
`)

// 界面显示（实时计算编号）
segments.map((segment, index) => {
  const displayNumber = index + 1  // 界面编号：1, 2, 3...
  return <SegmentCard number={displayNumber} segment={segment} />
})
```

### 2.3 示例场景

**初始状态：**
```
数据库 position:  1    2    3    4    5
界面显示编号:     #1   #2   #3   #4   #5
```

**删除段落3后：**
```
数据库 position:  1    2    4    5
界面显示编号:     #1   #2   #3   #4
```
- position 不变，只是少了3
- 界面重新计算，保持连续

**重要：** 不要用界面编号作为永久引用，应使用 `segment.id`

---

## 三、界面设计

### 3.1 附注列表（SegmentList - 编辑模式）

**布局：**
```
┌────────────────────────────────────┐
│ #1 原文预览文字...           [删除] │
│ #2 原文预览文字...           [删除] │
│ #3 原文预览文字...           [删除] │
└────────────────────────────────────┘
```

**功能：**
- 编辑模式下每个段落卡片右侧显示"删除"按钮
- 点击删除 → 弹出确认对话框 → 确认后从数据库硬删除
- 删除整个 Segment（包括原文、译文、所有附注）

---

### 3.2 附注详情页（SegmentDetail - 编辑模式）

**展示顺序：译文 → 附注条目 → 原文**

**布局结构：**
```
┌──────────────────────────────────────┐
│  ← 返回                              │
├──────────────────────────────────────┤
│                                      │
│  【译文】                             │
│  ┌────────────────────────────────┐  │
│  │ This is the translated text... │  │
│  │ [可编辑的文本框]                 │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  【附注】                        [+] │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 解释：段落 - 指文章中的...      │  │
│  │                        [✅] [❌] │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 注意：这里的"原始"是相对...     │  │
│  │                        [✅] [❌] │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │ ← 新增中的附注
│  │ [输入附注内容...]              │  │
│  │                        [✅] [❌] │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  【原文】                             │
│  ┌────────────────────────────────┐  │
│  │ 这是原始段落文本内容            │  │
│  │ [只读，灰色背景]                 │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  [保存] [翻译]                       │ ← 底部按钮
└──────────────────────────────────────┘
```

**样式说明：**
- 译文框：白色背景，可编辑，与原文框样式一致
- 附注条目：白色背景，带边框，右侧有 ✅ ❌ 按钮
- 原文框：灰色背景，只读，与译文框样式一致
- [翻译] 按钮：蓝色 primary 样式（与分割按钮一致）
- [保存] 按钮：默认样式，无修改时禁用

**显示/隐藏规则：**

**初始状态（无译文和附注）：**
```
┌──────────────────────────────────────┐
│  ← 返回                              │
├──────────────────────────────────────┤
│                                      │
│  【原文】                             │
│  ┌────────────────────────────────┐  │
│  │ 这是原始段落文本内容            │  │
│  │ [只读，灰色背景]                 │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  [翻译]                              │ ← 只有翻译按钮
└──────────────────────────────────────┘
```
- **不显示**译文区域
- **不显示**附注区域
- **不显示**保存按钮（因为没有可保存的内容）
- 只显示原文和翻译按钮

**有译文但无附注：**
- 显示译文区域
- **不显示**附注区域
- 显示保存和翻译按钮

**有译文和附注：**
- 显示译文区域
- 显示附注区域
- 显示保存和翻译按钮

**判断逻辑：**
```typescript
const hasTranslation = !!segment.translatedText
const hasNotes = segment.notes && segment.notes.length > 0

// 显示规则
showTranslationSection = hasTranslation
showNotesSection = hasNotes
showSaveButton = hasTranslation || hasNotes
```

---

### 3.3 附注条目组件（NoteItem）

**两种状态：**

**A. 已有附注（编辑/显示状态）**
```
┌────────────────────────────────┐
│ 解释：段落 - 指文章中的...      │
│                        [✅] [❌] │
└────────────────────────────────┘
```
- 可编辑文本区域
- ✅ 确认保存（临时，真正保存需点击底部"保存"）
- ❌ 删除该条附注

**B. 新增附注（编辑状态）**
```
┌────────────────────────────────┐
│ [输入附注内容...]              │
│                        [✅] [❌] │
└────────────────────────────────┘
```
- 空白输入框，占位符提示
- ✅ 确认新增（进入已有状态，但未保存到数据库）
- ❌ 取消新增

**交互规则：**
- 点击 [+] 按钮 → 出现新增输入框
- 输入内容后点击 ✅ → 确认，输入框变为已有附注样式
- 点击 ❌ → 取消新增，输入框消失
- **重要：** 只有确认（✅）或取消（❌）当前新增的附注后，才能继续点击 [+] 新增下一条

---

## 四、功能流程

### 4.1 翻译流程

**触发：** 点击详情页底部"翻译"按钮

**首次翻译步骤：**
1. 获取当前段落的 `originalText`
2. 显示加载状态："正在翻译..."
3. 调用翻译函数（临时Mock实现）
4. 接收返回的 `{ translatedText, notes }`
5. 更新界面：
   - 译文框显示 `translatedText`
   - 附注区域显示 `notes` 数组（每条作为一个 NoteItem）
6. 标记为已修改，启用"保存"按钮

**重新翻译行为（已有译文/附注时）：**

**译文处理：**
- **覆盖模式**：新生成的译文会**完全覆盖**当前译文
- 用户之前对译文的手动修改会丢失

**附注处理：**
- **追加模式**：新生成的附注会**追加到**现有附注列表末尾
- 保留所有已有附注（包括用户手动添加或修改的）
- 新附注添加到数组末尾

**示例：**
```
当前状态：
- 译文: "用户修改过的译文"
- 附注: ["附注1", "附注2"]

点击翻译后：
- 译文: "新生成的译文" （覆盖）
- 附注: ["附注1", "附注2", "新附注1", "新附注2"] （追加）
```

**临时Mock实现：**
```
输入：originalText = "这是一段测试文本"
输出：{
  translatedText: "这是一段测试文本",  // 原文作为译文
  notes: ["测试", "文本", "一段"]      // 随机抽取词汇
}
```

---

### 4.2 编辑译文流程

**触发：** 用户在译文框中修改内容

**步骤：**
1. 监听译文框的 `onChange` 事件
2. 更新本地状态 `translatedText`
3. 标记为已修改，启用"保存"按钮

---

### 4.3 新增附注流程

**触发：** 点击 [+] 按钮

**步骤：**
1. 检查是否有未确定的新增附注：
   - 如果有 → 提示"请先确认或取消当前附注"，阻止操作
   - 如果没有 → 继续
2. 在附注列表末尾添加一个空白输入框（新增状态）
3. 自动聚焦到输入框
4. 用户输入内容
5. 点击 ✅：
   - 验证内容非空
   - 将输入框转换为已有附注样式
   - 添加到本地 `notes` 数组
   - 标记为已修改，启用"保存"按钮
6. 点击 ❌：
   - 取消新增，移除输入框
   - 不修改 `notes` 数组

---

### 4.4 编辑已有附注流程

**触发：** 修改附注内容

**步骤：**
1. 监听附注输入框的 `onChange` 事件
2. 更新本地 `notes` 数组对应位置的内容
3. 标记为已修改，启用"保存"按钮

**点击 ✅：**
- 确认编辑（可选操作，也可以直接保存）

**点击 ❌：**
- 删除该条附注
- 从本地 `notes` 数组中移除
- 标记为已修改，启用"保存"按钮

---

### 4.5 删除附注流程

**A. 列表中删除整个段落**

**触发：** 点击列表中段落卡片的"删除"按钮

**步骤：**
1. 弹出确认对话框："确定删除该段落吗？此操作不可恢复！"
2. 用户确认
3. 调用 API 从数据库硬删除（DELETE）
4. 删除成功 → 刷新列表，移除该段落
5. **不更新其他段落的 `position`**（position 保持不变，用于排序）
6. 界面显示编号自动重新计算（基于数组索引）

**B. 详情页删除单条附注**

**触发：** 点击附注条目的 ❌ 按钮

**步骤：**
1. 从本地 `notes` 数组中移除该条
2. 标记为已修改，启用"保存"按钮
3. 用户需点击底部"保存"按钮才真正提交到数据库

---

### 4.6 保存流程

**触发：** 点击详情页底部"保存"按钮

**步骤：**
1. 收集当前状态：
   - `translatedText`（译文）
   - `notes`（附注数组，全量）
2. 调用 API 提交到数据库（全量更新）
3. 更新数据库中的 `isModified = true`
4. 保存成功 → 提示"保存成功"
5. 重置修改状态，禁用"保存"按钮（直到下次修改）

**注意：** 一次性提交 `translatedText` 和 `notes` 的完整状态，不是增量更新

---

### 4.7 修改检测逻辑

**判断是否有修改：**
- 译文被修改（`translatedText` ≠ 初始值）
- 附注被修改（`notes` 数组变化：增删改）

**实现方式：**
1. 进入详情页时，保存初始状态快照：
   ```
   initialState = {
     translatedText: segment.translatedText,
     notes: [...segment.notes]
   }
   ```

2. 实时对比当前状态与初始状态：
   ```
   hasChanges =
     currentTranslatedText !== initialState.translatedText ||
     JSON.stringify(currentNotes) !== JSON.stringify(initialState.notes)
   ```

3. 根据 `hasChanges` 控制"保存"按钮的启用/禁用

---

## 五、组件修改清单

### 5.1 新建组件

**A. NoteItem.tsx**
- 单个附注条目组件
- Props:
  - `note: string` - 附注内容
  - `isEditing: boolean` - 是否处于新增/编辑状态
  - `onConfirm: (content: string) => void` - 确认
  - `onDelete: () => void` - 删除/取消
  - `onChange: (content: string) => void` - 内容变化
- 显示可编辑的附注内容 + ✅ ❌ 按钮

**B. TranslationSection.tsx**
- 译文区域组件
- Props:
  - `translatedText: string` - 译文内容
  - `onChange: (text: string) => void` - 修改译文
  - `isEditing: boolean` - 是否可编辑
- 显示可编辑的译文文本框

**C. NotesSection.tsx**
- 附注列表区域组件
- Props:
  - `notes: string[]` - 附注数组
  - `isEditing: boolean` - 是否可编辑
  - `onAdd: () => void` - 新增附注
  - `onUpdate: (index: number, content: string) => void` - 更新附注
  - `onDelete: (index: number) => void` - 删除附注
- 显示附注列表 + [+] 按钮
- 管理新增附注的状态（是否有未确定的新增）

---

### 5.2 修改现有组件

**A. SegmentList.tsx**
- 编辑模式下，每个 SegmentCard 右侧显示"删除"按钮
- 新增 `onDelete: (segmentId: string) => void` 回调
- 点击删除 → 确认对话框 → 调用删除API

**B. SegmentDetail.tsx**
- 重构布局：译文 → 附注 → 原文
- 集成 TranslationSection、NotesSection 组件
- 底部按钮：
  - [保存] 按钮：根据 `hasChanges` 启用/禁用
  - [翻译] 按钮：调用翻译函数
- 管理本地状态：`translatedText`, `notes`, `hasChanges`
- 实现修改检测逻辑
- 实现保存逻辑

**C. TranslationPanel.tsx**
- 新增 `handleDelete` 函数，处理段落删除

---

## 六、API接口定义

### 6.1 翻译接口（临时Mock）

**Electron Main 进程：**

```
electronAPI.translateSegment(sourceText: string)
  → Promise<{ translatedText: string, notes: string[] }>
```

**临时实现逻辑：**
1. `translatedText` = `sourceText`
2. `notes` = 从 `sourceText` 中随机抽取2-5个词汇

---

### 6.2 保存附注接口

**Electron Main 进程：**

```
electronAPI.saveSegmentNotes(segmentId: string, data: {
  translatedText: string,
  notes: string[]
})
  → Promise<{ success: boolean, error?: string }>
```

**逻辑：**
1. 根据 `segmentId` 更新 `segments` 表
2. 更新字段：`translatedText`, `notes`, `isModified=true`
3. 返回操作结果

---

### 6.3 删除段落接口

**Electron Main 进程：**

```
electronAPI.deleteSegment(segmentId: string)
  → Promise<{ success: boolean, error?: string }>
```

**逻辑：**
1. 根据 `segmentId` 硬删除 `segments` 表记录（DELETE）
2. 返回操作结果

---

### 6.4 加载段落完整信息接口

**修改现有的 `loadSegments` 接口，确保返回：**
- `originalText`
- `translatedText`
- `notes`

---

## 七、状态管理

### 7.1 Store 扩展（segmentStore）

无需新增全局状态，译文和附注数据已包含在 `Segment` 对象中。

### 7.2 详情页本地状态（SegmentDetail）

```
localState = {
  translatedText: string
  notes: string[]
  hasChanges: boolean
  isAddingNote: boolean      // 是否正在新增附注
  isSaving: boolean          // 是否正在保存
  isTranslating: boolean     // 是否正在翻译
}
```

---

## 八、数据库 Schema 变更

### 8.1 开发环境数据清理

**重要：不使用 ALTER TABLE，而是完全重建数据库**

**步骤：**
1. 调用本地已有的清空项目数据脚本
2. 删除数据库中的所有表（DROP TABLE）
3. 应用启动时按照新格式创建数据库表

**优点：**
- 避免迁移脚本的复杂性
- 确保数据结构完全符合新设计
- 开发阶段可快速迭代

### 8.2 segments 表完整结构（含新字段）

```sql
CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  chapter_href TEXT NOT NULL,
  xpath TEXT NOT NULL,
  cfi_range TEXT,
  position REAL NOT NULL,
  is_empty INTEGER DEFAULT 0,
  parent_segment_id TEXT,
  preview TEXT,
  text_length INTEGER,

  -- 新增字段
  original_text TEXT,              -- 原始文本（从EPUB提取）
  translated_text TEXT,            -- 译文
  notes TEXT,                      -- 附注数组（JSON格式）
  is_modified INTEGER DEFAULT 0,   -- 是否被修改过

  created_at TEXT NOT NULL,
  updated_at TEXT,

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

**字段说明：**
- `original_text`：段落的原始文本内容
- `translated_text`：翻译生成或用户编辑的译文（可为空）
- `notes`：附注条目数组，存储为 JSON 字符串，如 `["附注1", "附注2"]`（可为空）
- `is_modified`：标记译文或附注是否被修改过

---

## 九、实施步骤建议

### Phase 1：基础数据结构
1. 数据库 Schema 变更（新增字段）
2. 修改 `parseSegments` 函数，提取时保存 `originalText`
3. 修改 `loadSegments` 接口，返回完整数据

### Phase 2：翻译功能（Mock）
1. 实现 `translateSegment` API（临时Mock）
2. 修改 SegmentDetail，添加"翻译"按钮
3. 调用翻译API，显示译文和附注

### Phase 3：译文编辑
1. 创建 TranslationSection 组件
2. 实现译文文本框（可编辑）
3. 实现修改检测

### Phase 4：附注编辑
1. 创建 NoteItem 组件
2. 创建 NotesSection 组件
3. 实现新增、编辑、删除附注功能
4. 实现"未确定的新增"限制逻辑

### Phase 5：保存功能
1. 实现 `saveSegmentNotes` API
2. 实现详情页"保存"按钮
3. 实现修改检测与保存状态控制

### Phase 6：删除功能
1. 实现 `deleteSegment` API
2. 在 SegmentList 中添加删除按钮
3. 实现确认对话框与删除逻辑

### Phase 7：UI优化
1. 调整详情页布局（译文 → 附注 → 原文）
2. 统一样式（按钮、输入框、提示）
3. 优化交互反馈（加载状态、错误提示）

---

## 十、注意事项

### 10.1 数据一致性

- 保存时全量更新 `translatedText` 和 `notes`，不做增量
- 删除附注后，`notes` 数组中的空元素需清理
- 确保 `notes` 存储为有效的 JSON 数组字符串

### 10.2 用户体验

- 未保存的修改在离开详情页前应提示确认
- 翻译过程显示加载动画
- 保存成功/失败都要有明确的提示
- 删除操作需要二次确认

### 10.3 性能优化

- 附注数组不宜过大（建议上限100条）
- 译文和附注的保存是原子操作，要么全成功要么全失败
- 列表中不显示完整译文和附注，只显示原文预览

### 10.4 扩展性

- 预留翻译服务商配置（将来替换Mock实现）
- 预留附注的关键词、位置等扩展字段（当前简化为字符串）
- 考虑将来支持富文本附注（Markdown等）

---

## 十一、Mock翻译函数示例逻辑

### 输入
```
sourceText = "这是一段测试文本，包含多个词汇和概念。"
```

### 处理
1. `translatedText` = `sourceText`（直接返回原文）
2. 分词或字符拆分，提取2-5个随机词汇
3. 每个词汇生成一条附注：`"[词汇]: 这是关于[词汇]的解释"`

### 输出
```json
{
  "translatedText": "这是一段测试文本，包含多个词汇和概念。",
  "notes": [
    "测试: 这是关于测试的解释",
    "文本: 这是关于文本的解释",
    "词汇: 这是关于词汇的解释"
  ]
}
```

---

## 十二、界面交互细节补充

### 12.1 译文区域

- **无译文：** **不显示**译文区域（整个区域隐藏）
- **有译文：** 显示译文区域，内容可编辑
- **修改后：** 右上角显示"已修改"标记（可选）

### 12.2 附注区域

- **无附注：** **不显示**附注区域（整个区域隐藏）
- **有附注：** 显示附注区域 + [+] 按钮，列表可编辑和删除
- **可添加：** 编辑模式下可通过 [+] 按钮手动添加附注

### 12.3 原文区域

- **始终显示：** 不可编辑，灰色背景
- **长文本：** 支持滚动查看
- **标签：** 顶部显示"原文"标签

### 12.4 按钮状态

**[保存] 按钮：**
- 无修改：禁用，灰色
- 有修改：启用，默认样式
- 保存中：加载状态，文字变为"保存中..."

**[翻译] 按钮：**
- 默认：启用，蓝色 primary 样式
- 翻译中：加载状态，文字变为"翻译中..."
- 已有译文：提示"重新翻译将覆盖当前译文，新附注会追加到现有列表，是否继续？"

---

## 十三、错误处理

### 13.1 翻译失败

- 显示错误提示："翻译失败，请重试"
- 保持原有状态不变
- [翻译] 按钮恢复可用

### 13.2 保存失败

- 显示错误提示："保存失败: [具体错误信息]"
- 保持修改状态，允许重新保存
- [保存] 按钮恢复可用

### 13.3 删除失败

- 显示错误提示："删除失败: [具体错误信息]"
- 保持段落不变
- 允许重新尝试删除

---

## 十四、设计原则

1. **渐进式实现：** 先实现核心功能（翻译、保存），再优化交互
2. **用户友好：** 操作提示清晰，错误处理完善
3. **数据安全：** 重要操作（删除）二次确认，未保存修改有提示
4. **扩展性：** 数据结构和API设计考虑未来扩展
5. **性能优先：** 避免不必要的重渲染和数据库操作

---

文档版本：v1.0
创建时间：2025-10-27
分支：epub-notes
