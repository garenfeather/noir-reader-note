# 合并功能CFI生成问题修复

## 问题描述

用户报告错误："无法生成合并段落的CFI，请确保当前页面已加载相关章节"

## 原因分析

`generateMergedCFI()` 函数需要在 epub.js 的 rendition 中找到对应的DOM元素来生成CFI。如果用户在附注列表页点击合并，但此时阅读器显示的是其他章节的内容，rendition 中就找不到要合并的段落元素，导致CFI生成失败。

## 解决方案

### 自动跳转到目标章节

在合并前自动跳转到第一个段落的位置，确保相关章节已加载到 rendition：

```typescript
// 先跳转到第一个段落，确保相关章节已加载到 rendition
if (targetSegment.cfiRange) {
  console.log('跳转到目标段落以确保章节已加载...')
  await jumpToCfi(targetSegment.cfiRange)

  // 等待800ms，确保 rendition 完全加载
  await new Promise(resolve => setTimeout(resolve, 800))
} else {
  // 如果没有CFI，尝试从XPath生成
  const generatedCFI = generateCFIFromXPath(targetSegment.xpath, rendition)
  if (generatedCFI) {
    await jumpToCfi(generatedCFI)
    await new Promise(resolve => setTimeout(resolve, 800))
  }
}
```

### 改进的用户体验

1. **加载提示**：显示"正在准备合并..."
2. **详细错误信息**：提供更友好的错误提示和调试信息
3. **自动清理**：确保在所有情况下都关闭加载提示

### 完整流程

```
用户点击合并
  ↓
显示确认对话框
  ↓
用户确认
  ↓
显示"正在准备合并..."
  ↓
跳转到第一个段落位置
  ↓
等待800ms让rendition加载
  ↓
生成合并CFI
  ↓
获取合并文本长度
  ↓
调用后端合并API
  ↓
刷新列表
  ↓
显示成功提示
```

## 修改的代码

**文件**：`src/components/SegmentList.tsx`

**主要改动**：
- 添加自动跳转逻辑
- 添加等待时间（800ms）
- 改进错误提示
- 添加详细的调试日志

## 测试步骤

1. 打开一个项目
2. 在目录中点击某个章节（例如第3章）
3. 在附注列表中点击另一个章节（例如第1章）的附注
4. 进入编辑模式，选择该章节的多个段落
5. 点击合并
   - **预期**：自动跳转到第1章，成功生成CFI并完成合并
   - **之前**：报错"无法生成合并段落的CFI"

## 技术要点

### 为什么需要等待800ms？

- epub.js 的 `jumpToCfi` 是异步操作
- 但它不会等待渲染完成就返回
- 需要额外的时间让 rendition 完全加载新章节的DOM
- 800ms是一个合理的等待时间，既不会太长影响体验，也足够让大多数章节加载完成

### 为什么有回退方案？

- 某些段落可能没有预先计算的CFI（例如新创建的段落）
- 在这种情况下，从XPath动态生成CFI作为备用方案
- 确保功能的健壮性

### 调试信息

如果CFI生成失败，控制台会输出：
```javascript
{
  startXPath: "/html/body/p[1]",
  endXPath: "/html/body/p[3]",
  renditionAvailable: true,
  targetCFI: "epubcfi(...)",
  lastCFI: "epubcfi(...)",
  currentSection: { ... }
}
```

这些信息帮助开发者诊断问题。

## 已知限制

1. **跳转延迟**：用户会看到阅读器短暂跳转到要合并的段落位置（体验可接受）
2. **大型章节**：如果章节很大，800ms可能不够，可以根据实际情况调整
3. **离线场景**：如果EPUB文件损坏或缺失，跳转可能失败

## 未来优化

1. 监听 rendition 的 `relocated` 事件，而不是固定等待时间
2. 显示跳转动画，让用户知道正在发生什么
3. 支持批量合并时只跳转一次

## 相关文件

- `src/components/SegmentList.tsx:292-419`
- `src/utils/highlightHelper.ts:344-419`
