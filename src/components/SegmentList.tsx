/**
 * 分段列表组件
 * 显示所有分段卡片
 */

import { List, Spin, Empty, Button, Space } from 'antd'
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons'
import { useEffect, useRef, useCallback } from 'react'
import { useSegmentStore } from '../store/segmentStore'
import { useBookStore } from '../store/bookStore'
import SegmentCard from './SegmentCard'
import SegmentDetail from './SegmentDetail'
import {
  findElementInRendition,
  applyHoverHighlightByCfi,
  removeHighlightByCfi,
  flashHighlightByCfi,
  addDomHoverHighlight,
  removeDomHoverHighlight,
  addDomFlashHighlight,
  scrollToElement,
  setupStyleInjection
} from '../utils/highlightHelper'

interface Props {
  onAccept: () => void
  onDiscard: () => void
  allowEditing: boolean
  mode: 'read' | 'translate'
}

function SegmentList({ onAccept, onDiscard, allowEditing, mode }: Props) {
  const {
    visibleSegments,
    hoveredSegmentId,
    selectedSegmentId,
    isLoading,
    isParsed,
    isEditMode,
    setHoveredSegment,
    setSelectedSegment,
    setEditMode
  } = useSegmentStore()

  const { rendition } = useBookStore()
  const lastRenditionRef = useRef<typeof rendition>(null)

  // 记录当前悬停高亮的 CFI
  const hoverHighlightCfi = useRef<string | null>(null)
  // 记录当前高亮的 DOM 元素，用于兜底移除
  const hoverHighlightElement = useRef<Element | null>(null)
  // 记录当前闪烁高亮的清理函数
  const flashHighlightCleanup = useRef<(() => void) | null>(null)

  // 初始化样式注入：监听 rendition 变化，自动注入高亮样式
  useEffect(() => {
    if (rendition) {
      setupStyleInjection(rendition)
      lastRenditionRef.current = rendition
    }
  }, [rendition])

  const removeHoverHighlights = useCallback(() => {
    const targetRendition = rendition ?? lastRenditionRef.current

    if (hoverHighlightCfi.current && targetRendition) {
      removeHighlightByCfi(targetRendition, hoverHighlightCfi.current)
      hoverHighlightCfi.current = null
    }

    if (hoverHighlightElement.current) {
      removeDomHoverHighlight(hoverHighlightElement.current)
      hoverHighlightElement.current = null
    }
  }, [rendition])

  // 监听 hoveredSegmentId 变化，添加/移除阅读界面高亮
  useEffect(() => {
    const targetRendition = rendition ?? lastRenditionRef.current
    if (!targetRendition) return

    // 移除之前的悬停高亮
    removeHoverHighlights()

    // 添加新的悬停高亮
    if (hoveredSegmentId) {
      const segment = visibleSegments.find(s => s.id === hoveredSegmentId)
      if (segment?.cfiRange) {
        applyHoverHighlightByCfi(targetRendition, segment.cfiRange)
        hoverHighlightCfi.current = segment.cfiRange
      } else if (segment?.xpath) {
        const element = findElementInRendition(segment.xpath, targetRendition)
        if (element) {
          addDomHoverHighlight(element)
          hoverHighlightElement.current = element
        }
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

  // 处理接受
  const handleAccept = () => {
    if (!allowEditing) return
    onAccept()
    setEditMode(false) // 退出编辑模式
  }

  // 处理丢弃
  const handleDiscard = () => {
    if (!allowEditing) return
    onDiscard()
    setEditMode(false) // 退出编辑模式
  }

  // 处理编辑
  const handleEdit = () => {
    if (!allowEditing) return
    setEditMode(true) // 进入编辑模式
  }

  const triggerFlashHighlight = useCallback((segment: typeof visibleSegments[0]) => {
    const targetRendition = rendition ?? lastRenditionRef.current
    if (!targetRendition) return

    if (flashHighlightCleanup.current) {
      flashHighlightCleanup.current()
      flashHighlightCleanup.current = null
    }

    if (segment.cfiRange) {
      flashHighlightCleanup.current = flashHighlightByCfi(targetRendition, segment.cfiRange)
    } else if (segment.xpath) {
      const element = findElementInRendition(segment.xpath, targetRendition)
      if (element) {
        addDomFlashHighlight(element)
      }
    }
  }, [rendition])

  // 处理卡片点击
  const handleCardClick = (segment: typeof visibleSegments[0]) => {
    // 清除 hover 状态，避免冲突
    setHoveredSegment(null)

    // 进入详情页
    setSelectedSegment(segment.id)

    // 异步执行跳转和闪烁高亮
    requestAnimationFrame(() => {
      const targetRendition = rendition ?? lastRenditionRef.current
      if (!targetRendition) return

      // 如果有 CFI，使用 CFI 跨页跳转
      if (segment.cfiRange) {
        // 调用 rendition.display 跳转到目标页面
        const handleRelocated = () => {
          const element = findElementInRendition(segment.xpath, targetRendition)
          if (element) {
            scrollToElement(element)
          }
          triggerFlashHighlight(segment)
          targetRendition.off('relocated', handleRelocated)
        }

        targetRendition.on('relocated', handleRelocated)

        targetRendition.display(segment.cfiRange).catch((error) => {
          console.warn('CFI 跳转失败:', segment.cfiRange, error)
          targetRendition.off('relocated', handleRelocated)
        })
      } else {
        // 降级：没有 CFI，仅在当前页面尝试定位
        const element = findElementInRendition(segment.xpath, targetRendition)
        if (element) {
          scrollToElement(element)
          triggerFlashHighlight(segment)
        } else {
          console.warn('无法跳转：元素不在当前页面，且缺少 CFI')
        }
      }
    })
  }

  // 获取选中的段落
  const selectedSegment = visibleSegments.find(s => s.id === selectedSegmentId)
  const selectedIndex = selectedSegment
    ? visibleSegments.findIndex(s => s.id === selectedSegmentId)
    : -1

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin tip="正在分析段落..." />
      </div>
    )
  }

  if (!isParsed || visibleSegments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Empty description={mode === 'translate' ? '点击「分割」按钮开始分段' : '当前章节暂无附注'} />
      </div>
    )
  }

  // 如果选中了段落,显示详情页面
  if (selectedSegment && selectedIndex >= 0) {
    return (
      <SegmentDetail
        segment={selectedSegment}
        index={selectedIndex}
        onBack={() => setSelectedSegment(null)}
      />
    )
  }

  // 显示段落列表
  return (
    <div className="h-full flex flex-col">
      {/* 分段列表 */}
      <div className="flex-1 overflow-auto px-4 py-2">
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
            // 编辑模式：显示接受/丢弃按钮
            <Space className="w-full justify-center" direction="horizontal" size="middle">
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleAccept}
              >
                接受
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={handleDiscard}
              >
                丢弃
              </Button>
            </Space>
          ) : (
            // 非编辑模式：显示编辑按钮
            <div className="w-full flex justify-center">
              <Button
                icon={<EditOutlined />}
                onClick={handleEdit}
              >
                编辑
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default SegmentList
