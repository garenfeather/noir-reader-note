# 分段合并功能设计

## 功能概述

在编辑模式的附注列表页，长按附注进入多选模式，选中多个连续附注后右键展开菜单提供合并选项，合并后多个附注段落成为一个。

## 数据库设计

### 新增字段

`segments` 表添加字段：
- `endXPath TEXT NULL` - 合并段落的结束XPath，普通段落为 null

### 字段说明

**普通段落**：
```
xpath: "/html/body/p[5]"
endXPath: null
```

**合并段落**：
```
xpath: "/html/body/p[1]"        // 起始段落
endXPath: "/html/body/p[3]"     // 结束段落
cfiRange: "epubcfi(...)"        // 从p1起点到p3终点的完整CFI
preview: "第一段内容..."        // 保持第一个段落的preview不变
textLength: 21                  // 重新计算的总字符数
```

## 合并限制

1. **内容限制**：只允许没有译文（translatedText）和附注（notes）的段落合并
2. **连续性校验**：使用 position 字段校验，选中的段落必须连续（如1234中删除了3，则124不能合并）
3. **空段落排除**：isEmpty=true 的段落不允许合并
4. **同章节限制**：只能合并同一章节（chapterHref相同）的段落

## 合并方式

### 数据更新
1. 更新第一条附注：
   - `endXPath` = 最后一个段落的 xpath
   - `cfiRange` = 前端计算的新CFI（从第一段起点到最后一段终点）
   - `textLength` = 重新计算的总字符数
   - `preview` 保持不变
   - `xpath` 保持不变
   - `position` 保持不变

2. 删除其余附注记录

3. 删除被合并附注的书签记录（合并前操作）

### 文本提取
修改后端 `getSegmentTextByXPath()` 方法：
- 检测到 `endXPath` 存在时，提取从 `xpath` 到 `endXPath` 范围内的所有段落元素
- 对每个元素调用现有的 `getTextContent()` 方法
- 用单换行符 `\n` 连接各段落文本

### CFI 计算
前端计算后传给后端：
- 在 `highlightHelper.ts` 添加方法生成合并CFI
- 找到第一个段落的起始文本节点和最后一个段落的结束文本节点
- 使用 `section.cfiFromRange()` 生成完整CFI
- 传给后端保存

## UI 交互流程

### 1. 进入多选模式
- 长按附注卡片 800ms 触发
- 卡片左侧显示复选框
- 触发的卡片自动选中
- 页面顶部显示提示："已选择 N 个附注"

### 2. 选择附注
- 点击卡片切换选中状态
- 实时校验：连续性、无译文、无附注
- 违规选择时显示 toast 提示

### 3. 右键菜单
- 在选中的卡片上右键点击
- 弹出菜单显示"合并选中的附注"选项
- 选中少于2个或不满足合并条件时菜单项禁用

### 4. 执行合并
- 点击菜单项弹出确认对话框
- 显示将要合并的段落数量
- 确认后：
  1. 前端计算合并后的CFI
  2. 调用后端合并API
  3. 后端删除书签、更新数据
  4. 前端刷新列表、退出多选模式

### 5. 退出多选模式
- 点击顶部"取消"按钮
- 或完成合并后自动退出

## 文件修改清单

### 前端组件
- `src/components/SegmentList.tsx` - 多选模式、右键菜单
- `src/components/SegmentCard.tsx` - 长按事件、复选框、选中状态

### 状态管理
- `src/store/segmentStore.ts` - 添加多选相关状态和actions
- `src/types/segment.d.ts` - Segment 类型添加 endXPath 字段
- `src/types/electron.d.ts` - 添加合并API类型定义

### 前端工具
- `src/utils/highlightHelper.ts` - 添加生成合并CFI的方法

### 后端服务
- `services/database.js` - 添加 mergeSegments 方法（事务操作）
- `services/segment.js` - 修改 getSegmentTextByXPath 支持范围提取
- `electron.js` - 添加 IPC 处理器 `segments:merge`
- `preload.js` - 暴露 mergeSegments API

## 状态管理

在 `segmentStore.ts` 添加：

### 状态
- `isMultiSelectMode: boolean` - 是否处于多选模式
- `selectedSegmentIds: Set<string>` - 已选中的附注ID集合
- `longPressTimer: number | null` - 长按计时器ID

### Actions
- `setMultiSelectMode(enabled)` - 切换多选模式
- `toggleSegmentSelection(segmentId)` - 切换附注选中状态
- `clearSelection()` - 清空选择
- `canMergeSelection()` - 检查当前选择是否可合并

## 核心方法

### 前端验证
`validateMergeSelection()` - 返回 `{ valid: boolean, reason?: string }`
- 检查选中数量 >= 2
- 检查所有段落 chapterHref 相同
- 检查所有段落无 translatedText 和 notes
- 检查所有段落 isEmpty = false
- 检查 position 连续性

### 后端合并
`mergeSegments(targetId, sourceIds)` - 返回 `{ success, mergedSegment?, error? }`
1. 开始数据库事务
2. 验证合并条件
3. 查询所有附注和书签
4. 删除源附注的书签
5. 更新第一条附注的 endXPath、cfiRange、textLength
6. 删除源附注记录
7. 提交事务
8. 返回更新后的附注数据

## 错误处理

- 数据库操作失败时回滚事务
- 前端显示详细错误提示
- 日志记录所有关键操作

## 技术要点

### position 连续性校验
对 position 数组排序后，检查相邻元素差值是否都为 1

### 书签级联删除
数据库已有外键约束 `ON DELETE CASCADE`，删除附注时书签自动删除

### 文本提取优化
利用现有的缓存机制（cacheService），避免重复读取XHTML文件

### 事务保证原子性
使用 SQLite 事务确保合并操作要么全部成功，要么全部回滚
