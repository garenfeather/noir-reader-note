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
  setupHighlightTheme,
  applyHoverHighlight,
  removeHighlight,
  flashHighlight,
  generateCFIFromXPath
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
  // 记录当前闪烁高亮的清理函数
  const flashHighlightCleanup = useRef<(() => void) | null>(null)
  // 跳转状态跟踪
  const isJumpingRef = useRef(false)
  const jumpCleanupRef = useRef<(() => void) | null>(null)

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
        applyHoverHighlight(targetRendition, segment.cfiRange, segment.xpath)
        hoverHighlightCfi.current = segment.cfiRange || null
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

    // 获取有效的 CFI
    // 检查 CFI 是否有效（不是主进程生成的无效格式）
    const isInvalidCFI = segment.cfiRange && segment.cfiRange.includes('epubcfi(/!/')

    let cfi = segment.cfiRange

    if (isInvalidCFI || !cfi) {
      // CFI 无效或不存在，从 XPath 生成
      if (segment.xpath) {
        if (isInvalidCFI) {
          console.log('⚠️ CFI 无效，从 XPath 重新生成:', segment.cfiRange)
        } else {
          console.log('⏳ CFI 缺失，从 XPath 生成...', segment.xpath)
        }
        cfi = generateCFIFromXPath(segment.xpath, targetRendition)
      }
    }

    if (!cfi) {
      console.error('❌ 无法跳转: 无法获取有效的 CFI', {
        id: segment.id,
        cfiRange: segment.cfiRange,
        xpath: segment.xpath,
        isInvalid: isInvalidCFI
      })
      // 仍然进入详情页
      setSelectedSegment(segment.id)
      return
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
