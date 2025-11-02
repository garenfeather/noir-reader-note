# 分段合并功能 - 剩余实现要点

## 已完成部分 ✅

### 后端
- ✅ 类型定义（endXPath、mergeSegments API）
- ✅ segment.js 支持范围文本提取
- ✅ database.js 合并方法和数据库字段
- ✅ electron.js IPC 处理器
- ✅ preload.js API 暴露

### 前端
- ✅ SegmentDetail.tsx 支持 endXPath
- ✅ highlightHelper.ts 合并CFI生成方法

---

## 待实现部分

### 1. segmentStore.ts - 添加多选状态

在interface SegmentState中添加：

```typescript
// 多选模式相关
isMultiSelectMode: boolean
selectedSegmentIds: Set<string>
```

在create函数中添加初始值：

```typescript
isMultiSelectMode: false,
selectedSegmentIds: new Set<string>(),
```

添加actions：

```typescript
setMultiSelectMode: (enabled: boolean) => {
  if (!enabled) {
    set({ isMultiSelectMode: false, selectedSegmentIds: new Set() })
  } else {
    set({ isMultiSelectMode: true })
  }
},

toggleSegmentSelection: (segmentId: string) => {
  const selected = new Set(get().selectedSegmentIds)
  if (selected.has(segmentId)) {
    selected.delete(segmentId)
  } else {
    selected.add(segmentId)
  }
  set({ selectedSegmentIds: selected })
},

clearSelection: () => {
  set({ selectedSegmentIds: new Set() })
},
```

---

### 2. SegmentCard.tsx - 添加长按和复选框

添加props：

```typescript
interface Props {
  // ...existing props
  isMultiSelectMode?: boolean
  isSelected?: boolean
  onLongPress?: (segmentId: string) => void
  onSelect?: (segmentId: string) => void
}
```

添加长按逻辑：

```typescript
const [pressTimer, setPressTimer] = useState<number | null>(null)

const handleMouseDown = (e: React.MouseEvent) => {
  if (isMultiSelectMode) return

  const timer = window.setTimeout(() => {
    onLongPress?.(segment.id)
  }, 800)

  setPressTimer(timer)
}

const handleMouseUp = () => {
  if (pressTimer) {
    clearTimeout(pressTimer)
    setPressTimer(null)
  }
}

const handleClick = () => {
  if (isMultiSelectMode) {
    onSelect?.(segment.id)
  } else {
    onClick?.(segment, index)
  }
}
```

添加复选框UI（在卡片开头）：

```tsx
{isMultiSelectMode && (
  <div className="flex-shrink-0 mr-2">
    <input
      type="checkbox"
      checked={isSelected}
      onChange={() => onSelect?.(segment.id)}
      className="w-4 h-4"
    />
  </div>
)}
```

---

### 3. SegmentList.tsx - 添加多选模式和右键菜单

#### 导入依赖

```typescript
import { generateMergedCFI } from '../utils/highlightHelper'
import { useBookStore } from '../store/bookStore'
import { Menu, Dropdown } from 'antd'
```

#### 添加状态

```typescript
const {
  isMultiSelectMode,
  selectedSegmentIds,
  setMultiSelectMode,
  toggleSegmentSelection,
  clearSelection
} = useSegmentStore()

const { rendition } = useBookStore()
const [contextMenuVisible, setContextMenuVisible] = useState(false)
const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
```

#### 验证合并选择

```typescript
const validateMergeSelection = (): { valid: boolean; reason?: string } => {
  const selectedIds = Array.from(selectedSegmentIds)

  if (selectedIds.length < 2) {
    return { valid: false, reason: '至少选择2个段落' }
  }

  const selectedSegments = visibleSegments.filter(s => selectedIds.includes(s.id))

  // 检查是否都在同一章节
  const chapterHrefs = new Set(selectedSegments.map(s => s.chapterHref))
  if (chapterHrefs.size > 1) {
    return { valid: false, reason: '只能合并同一章节的段落' }
  }

  // 检查是否有译文或附注
  const hasContent = selectedSegments.some(s => s.translatedText || (s.notes && s.notes.length > 0))
  if (hasContent) {
    return { valid: false, reason: '不能合并有译文或附注的段落' }
  }

  // 检查是否有空段落
  const hasEmpty = selectedSegments.some(s => s.isEmpty)
  if (hasEmpty) {
    return { valid: false, reason: '不能合并空段落' }
  }

  // 检查position连续性
  const positions = selectedSegments.map(s => s.position).sort((a, b) => a - b)
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] - positions[i-1] !== 1) {
      return { valid: false, reason: '只能合并连续的段落' }
    }
  }

  return { valid: true }
}
```

#### 执行合并

```typescript
const handleMerge = async () => {
  const validation = validateMergeSelection()
  if (!validation.valid) {
    message.error(validation.reason)
    return
  }

  try {
    const selectedIds = Array.from(selectedSegmentIds).sort()
    const selectedSegments = visibleSegments
      .filter(s => selectedIds.includes(s.id))
      .sort((a, b) => a.position - b.position)

    const targetSegment = selectedSegments[0]
    const lastSegment = selectedSegments[selectedSegments.length - 1]
    const sourceIds = selectedIds.slice(1)

    // 计算合并后的CFI
    const mergedCFI = generateMergedCFI(
      targetSegment.xpath,
      lastSegment.xpath,
      rendition
    )

    if (!mergedCFI) {
      message.error('无法生成合并段落的CFI')
      return
    }

    // 获取合并后的文本长度
    const text = await window.electronAPI.getSegmentText(
      currentProject.id,
      targetSegment.chapterHref,
      targetSegment.xpath,
      lastSegment.xpath
    )

    const textLength = text.data?.text.length || 0

    // 调用合并API
    const result = await window.electronAPI.mergeSegments(
      targetSegment.id,
      sourceIds,
      lastSegment.xpath,
      mergedCFI,
      textLength
    )

    if (result.success) {
      message.success(`成功合并${selectedSegments.length}个段落`)
      // 退出多选模式
      setMultiSelectMode(false)
      // 刷新段落列表
      await loadSegmentsForChapter(activeChapterId!, activeChapterHref)
    } else {
      message.error(result.error || '合并失败')
    }
  } catch (error) {
    message.error('合并操作失败')
    console.error(error)
  }
}
```

#### 右键菜单

```typescript
const handleContextMenu = (e: React.MouseEvent) => {
  if (!isMultiSelectMode || selectedSegmentIds.size === 0) return

  e.preventDefault()
  setContextMenuPosition({ x: e.clientX, y: e.clientY })
  setContextMenuVisible(true)
}

const menu = (
  <Menu>
    <Menu.Item
      key="merge"
      disabled={!validateMergeSelection().valid}
      onClick={handleMerge}
    >
      合并选中的段落
    </Menu.Item>
  </Menu>
)
```

#### 更新SegmentCard props

```tsx
<SegmentCard
  segment={segment}
  index={index}
  onClick={handleCardClick}
  onHoverEnter={() => setHoveredSegment(segment.id)}
  onHoverLeave={() => setHoveredSegment(null)}
  isMultiSelectMode={isMultiSelectMode}
  isSelected={selectedSegmentIds.has(segment.id)}
  onLongPress={(id) => {
    setMultiSelectMode(true)
    toggleSegmentSelection(id)
  }}
  onSelect={toggleSegmentSelection}
/>
```

#### 顶部提示栏（多选模式下）

```tsx
{isMultiSelectMode && (
  <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between">
    <span className="text-sm text-blue-700">
      已选择 {selectedSegmentIds.size} 个附注
    </span>
    <Button size="small" onClick={() => setMultiSelectMode(false)}>
      取消
    </Button>
  </div>
)}
```

---

## 测试步骤

1. 启动应用，打开一个项目
2. 进入编辑模式
3. 长按一个附注卡片（800ms）
4. 验证进入多选模式，卡片左侧显示复选框
5. 点击其他附注选择
6. 尝试选择不连续的附注，验证错误提示
7. 选择连续的、无译文/note的附注
8. 右键点击，选择"合并"
9. 验证合并成功，附注列表更新
10. 点击合并后的附注，验证显示合并后的完整文本

---

## 注意事项

1. 合并操作不可逆，需在确认对话框中明确提示
2. 合并过程中禁用所有UI操作，显示loading状态
3. 合并失败时需要详细的错误提示
4. 合并成功后自动刷新列表并退出多选模式
5. 长按触发时长设为800ms（移动端标准）
