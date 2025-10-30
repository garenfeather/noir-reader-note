/**
 * 分段列表组件
 * 显示所有分段卡片
 */

import { List, Spin, Empty, Button, Space, Modal, message } from 'antd'
import { CheckOutlined, CloseOutlined, EditOutlined, ScissorOutlined, RollbackOutlined, DeleteOutlined } from '@ant-design/icons'
import { useEffect, useRef, useCallback } from 'react'
import { useSegmentStore } from '../store/segmentStore'
import { useBookStore } from '../store/bookStore'
import { useProjectStore } from '../store/projectStore'
import SegmentCard from './SegmentCard'
import SegmentDetail from './SegmentDetail'
import {
  setupHighlightTheme,
  applyHoverHighlight,
  removeHighlight,
  flashHighlight,
  generateCFIFromXPath
} from '../utils/highlightHelper'

interface Props {
  onAccept: () => void
  onDiscard: () => void
  onCancel: () => void
  onResegment: () => void
  onSegment: () => void
  allowEditing: boolean
  hasPersisted: boolean // 当前章节是否有持久化的分割结果
}

function SegmentList({ onAccept, onDiscard, onCancel, onResegment, onSegment, allowEditing, hasPersisted }: Props) {
  const {
    visibleSegments,
    hoveredSegmentId,
    selectedSegmentId,
    isLoading,
    isParsed,
    isEditMode,
    editSource,
    activeChapterId,
    activeChapterHref,
    setHoveredSegment,
    setSelectedSegment,
    setEditMode,
    setEditSource,
    setSegments,
    markSegmentDeleted,
    clearSegments,
    setParsed,
    removeChapterWithSegments
  } = useSegmentStore()

  const { currentProject, setHasUnsavedChanges } = useProjectStore()
  const { rendition } = useBookStore()
  const lastRenditionRef = useRef<typeof rendition>(null)

  // 记录当前悬停高亮的 CFI
  const hoverHighlightCfi = useRef<string | null>(null)
  // 记录当前闪烁高亮的清理函数
  const flashHighlightCleanup = useRef<(() => void) | null>(null)
  // 跳转状态跟踪
  const isJumpingRef = useRef(false)
  const jumpCleanupRef = useRef<(() => void) | null>(null)
  // 滚动位置保存
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const savedScrollPosition = useRef<number>(0)

  // 初始化高亮主题：监听 rendition 变化
  useEffect(() => {
    if (rendition) {
      setupHighlightTheme(rendition)
      lastRenditionRef.current = rendition
    }
  }, [rendition])

  const removeHoverHighlights = useCallback(() => {
    const targetRendition = rendition ?? lastRenditionRef.current

    if (hoverHighlightCfi.current && targetRendition) {
      removeHighlight(targetRendition, hoverHighlightCfi.current)
      hoverHighlightCfi.current = null
    }
  }, [rendition])

  // 监听 hoveredSegmentId 变化，添加/移除阅读界面高亮
  useEffect(() => {
    const targetRendition = rendition ?? lastRenditionRef.current
    if (!targetRendition) return

    // 移除之前的悬停高亮
    removeHoverHighlights()

    // 添加新的悬停高亮 (优先使用 CFI，否则从 XPath 生成)
    if (hoveredSegmentId) {
      const segment = visibleSegments.find(s => s.id === hoveredSegmentId)
      if (segment) {
        const appliedCFI = applyHoverHighlight(
          targetRendition,
          segment.cfiRange,
          segment.xpath
        )
        hoverHighlightCfi.current = appliedCFI
      }
    }

    // 清理函数
    return () => {
      removeHoverHighlights()
    }
  }, [hoveredSegmentId, visibleSegments, rendition, removeHoverHighlights])

  // 组件卸载时清理高亮
  useEffect(() => {
    return () => {
      removeHoverHighlights()
      if (flashHighlightCleanup.current) {
        flashHighlightCleanup.current()
        flashHighlightCleanup.current = null
      }
    }
  }, [removeHoverHighlights])

  // 监听详情页返回，恢复滚动位置
  useEffect(() => {
    // 当从详情页返回列表时（selectedSegmentId 从有值变为 null），恢复滚动位置
    if (!selectedSegmentId && scrollContainerRef.current && savedScrollPosition.current > 0) {
      // 使用 setTimeout 确保 DOM 已经渲染完成
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedScrollPosition.current
        }
      }, 0)
    }
  }, [selectedSegmentId])

  // 处理接受（分割状态）
  const handleAccept = () => {
    if (!allowEditing) return
    onAccept()
    setEditMode(false)
    setEditSource(null)
  }

  // 处理丢弃（分割状态）
  const handleDiscard = () => {
    if (!allowEditing) return
    onDiscard()
    setEditMode(false)
    setEditSource(null)
  }

  // 处理取消（编辑状态）
  const handleCancel = () => {
    if (!allowEditing) return
    onCancel()
    setEditMode(false)
    setEditSource(null)
  }

  // 处理重新分割（编辑状态 → 分割状态）
  const handleResegment = () => {
    if (!allowEditing) return
    onResegment()
    setEditSource('segment')
  }

  // 处理编辑（只读 → 编辑状态）
  const handleEdit = () => {
    if (!allowEditing) return
    setEditMode(true)
    setEditSource('edit')
  }

  // 处理分割（只读 → 分割状态）
  const handleSegment = () => {
    if (!allowEditing) return
    onSegment()
    setEditMode(true)
    setEditSource('segment')
  }

  // 处理清空章节
  const handleClear = () => {
    if (!allowEditing || !currentProject || !activeChapterId) {
      message.error('项目信息缺失')
      return
    }

    Modal.confirm({
      title: '确认清空',
      content: '确定要清空当前章节的所有附注吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const result = await window.electronAPI.clearChapterSegments(
            currentProject.id,
            activeChapterId
          )

          if (result.success) {
            message.success(`已清空 ${result.deletedCount || 0} 个附注`)
            // 清空本地状态
            clearSegments()
            setParsed(false)
            setHasUnsavedChanges(false)
            // 移除章节的小菱形标识
            if (activeChapterHref) {
              removeChapterWithSegments(activeChapterHref)
            }
          } else {
            message.error('清空失败: ' + result.error)
          }
        } catch (error) {
          console.error('清空章节失败:', error)
          message.error('清空失败')
        }
      }
    })
  }

  const triggerFlashHighlight = useCallback((segment: typeof visibleSegments[0]) => {
    const targetRendition = rendition ?? lastRenditionRef.current
    if (!targetRendition) return

    // 清理之前的闪烁高亮
    if (flashHighlightCleanup.current) {
      flashHighlightCleanup.current()
      flashHighlightCleanup.current = null
    }

    // 闪烁高亮 (优先使用 CFI，否则从 XPath 生成)
    flashHighlightCleanup.current = flashHighlight(
      targetRendition,
      segment.cfiRange,
      1500, // duration
      segment.xpath
    )
  }, [rendition])

  // 处理卡片点击 - 使用 Ref 跟踪状态
  const handleCardClick = (segment: typeof visibleSegments[0]) => {
    const targetRendition = rendition ?? lastRenditionRef.current
    if (!targetRendition) {
      console.warn('handleCardClick: rendition 不可用')
      return
    }

    // 防止重复点击
    if (isJumpingRef.current) {
      console.warn('跳转进行中,请稍候')
      return
    }

    const rawCFI = segment.cfiRange
    const hasCFI = !!rawCFI
    const isInvalidCFI = rawCFI ? rawCFI.includes('epubcfi(/!/') : false

    if (!hasCFI) {
      console.debug('handleCardClick: 缺少 CFI，跳过阅读区域跳转', {
        id: segment.id,
        xpath: segment.xpath
      })
      // 保存滚动位置
      if (scrollContainerRef.current) {
        savedScrollPosition.current = scrollContainerRef.current.scrollTop
      }
      setHoveredSegment(null)
      setSelectedSegment(segment.id)
      return
    }

    let cfi: string | null | undefined = rawCFI

    if (isInvalidCFI && segment.xpath) {
      console.log('⚠️ CFI 无效，从 XPath 重新生成:', rawCFI)
      cfi = generateCFIFromXPath(segment.xpath, targetRendition)
    }

    if (!cfi) {
      console.error('❌ 无法跳转: 无法获取有效的 CFI', {
        id: segment.id,
        cfiRange: segment.cfiRange,
        xpath: segment.xpath,
        isInvalid: isInvalidCFI
      })
      // 保存滚动位置
      if (scrollContainerRef.current) {
        savedScrollPosition.current = scrollContainerRef.current.scrollTop
      }
      setHoveredSegment(null)
      setSelectedSegment(segment.id)
      return
    }

    // 保存滚动位置
    if (scrollContainerRef.current) {
      savedScrollPosition.current = scrollContainerRef.current.scrollTop
    }

    // 清除 hover 状态
    setHoveredSegment(null)

    // 进入详情页
    setSelectedSegment(segment.id)

    // 设置跳转状态
    isJumpingRef.current = true

    // 定义 relocated 处理函数
    const handleRelocated = () => {
      if (!isJumpingRef.current) return // 已被取消

      console.log('✅ 页面跳转完成,准备触发高亮')

      // 等待 DOM 稳定后触发闪烁高亮
      setTimeout(() => {
        if (isJumpingRef.current) {
          triggerFlashHighlight(segment)
        }
        cleanup()
      }, 100)
    }

    // 清理函数
    const cleanup = () => {
      isJumpingRef.current = false
      targetRendition.off('relocated', handleRelocated)
      if (timeoutId) clearTimeout(timeoutId)
      jumpCleanupRef.current = null
    }

    jumpCleanupRef.current = cleanup

    // 注册 relocated 监听器
    targetRendition.on('relocated', handleRelocated)

    // 设置超时保护
    const timeoutId = setTimeout(() => {
      if (isJumpingRef.current) {
        console.warn('⚠️ relocated 事件超时 (3秒)')
        cleanup()
      }
    }, 3000)

    // 执行 CFI 跳转
    targetRendition.display(cfi).catch((error) => {
      console.group('❌ CFI 跳转失败')
      console.error('CFI:', cfi)
      console.error('Segment ID:', segment.id)
      console.error('Chapter:', segment.chapterHref)
      console.error('错误:', error)
      console.error('可能原因:')
      console.error('  1. CFI 格式无效')
      console.error('  2. 目标页面不存在')
      console.error('  3. epub.js 内部错误')
      console.groupEnd()
      cleanup()
    })
  }

  // 处理删除分段（仅标记删除，不弹窗）
  const handleDelete = (segmentId: string) => {
    markSegmentDeleted(segmentId)
  }

  // 获取选中的段落
  const selectedSegment = visibleSegments.find(s => s.id === selectedSegmentId)
  const selectedIndex = selectedSegment
    ? visibleSegments.findIndex(s => s.id === selectedSegmentId)
    : -1

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Spin size="large" />
        <div className="text-gray-500">正在分析段落...</div>
      </div>
    )
  }

  // 如果没有解析或没有段落，显示空状态和底部按钮
  if (!isParsed || visibleSegments.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* 空状态提示 */}
        <div className="flex-1 flex items-center justify-center">
          <Empty description="当前章节暂无附注" />
        </div>

        {/* 底部操作按钮 */}
        {allowEditing && !isParsed && (
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="w-full flex justify-center">
              {!hasPersisted && (
                // 无持久化结果：显示分割按钮
                <Button
                  type="primary"
                  icon={<ScissorOutlined />}
                  onClick={handleSegment}
                >
                  分割
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 如果选中了段落,显示详情页面
  if (selectedSegment && selectedIndex >= 0) {
    // 只有在编辑模式下才允许编辑附注
    const allowEdit = isEditMode

    return (
      <SegmentDetail
        segment={selectedSegment}
        index={selectedIndex}
        onBack={() => setSelectedSegment(null)}
        allowEdit={allowEdit}
      />
    )
  }

  // 显示段落列表
  return (
    <div className="h-full flex flex-col">
      {/* 分段列表 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto px-4 py-2">
        <List
          dataSource={visibleSegments}
          renderItem={(segment, index) => (
            <List.Item key={segment.id} className="!border-none !p-0">
              <SegmentCard
                segment={segment}
                index={index}
                isHovered={hoveredSegmentId === segment.id}
                onMouseEnter={() => setHoveredSegment(segment.id)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => handleCardClick(segment)}
                onDelete={handleDelete}
                showDelete={isEditMode}
                isReadOnly={!isEditMode}
              />
            </List.Item>
          )}
        />
      </div>

      {/* 底部操作按钮 */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="mb-2 text-xs text-gray-500 text-center">
          共 {visibleSegments.length} 个段落
        </div>
        {allowEditing && (
          isEditMode ? (
            editSource === 'segment' ? (
              // 通过分割/重新分割进入编辑模式：显示接受、取消按钮
              <Space className="w-full justify-center" direction="horizontal" size="middle">
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleAccept}
                >
                  接受
                </Button>
                <Button
                  icon={hasPersisted ? <RollbackOutlined /> : <CloseOutlined />}
                  onClick={hasPersisted ? handleCancel : handleDiscard}
                  danger={!hasPersisted}
                >
                  取消
                </Button>
              </Space>
            ) : (
              // 通过编辑按钮进入编辑模式：显示保存、取消、重新分割按钮
              <Space className="w-full justify-center" direction="horizontal" size="small">
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleAccept}
                >
                  保存
                </Button>
                <Button
                  icon={<RollbackOutlined />}
                  onClick={handleCancel}
                >
                  取消
                </Button>
                <Button
                  icon={<ScissorOutlined />}
                  onClick={handleResegment}
                >
                  重新分割
                </Button>
              </Space>
            )
          ) : (
            // 只读模式：根据是否有持久化结果显示不同按钮
            <div className="w-full flex justify-center">
              {hasPersisted ? (
                // 有持久化结果：显示编辑和清空按钮
                <Space direction="horizontal" size="middle">
                  <Button
                    icon={<EditOutlined />}
                    onClick={handleEdit}
                  >
                    编辑
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleClear}
                  >
                    清空
                  </Button>
                </Space>
              ) : (
                // 无持久化结果：显示分割按钮
                <Button
                  type="primary"
                  icon={<ScissorOutlined />}
                  onClick={handleSegment}
                >
                  分割
                </Button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default SegmentList
