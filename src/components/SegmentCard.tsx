/**
 * 分段卡片组件
 * 显示单个段落的预览文字（从数据库加载）
 */

import { useState } from 'react'
import { Card, Button } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { Segment } from '../types/segment'
import BookmarkButton from './BookmarkButton'

interface Props {
  segment: Segment
  index: number
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  onDelete?: (segmentId: string) => void
  showDelete?: boolean
  isReadOnly?: boolean  // 是否为只读模式
  isMultiSelectMode?: boolean  // 是否处于多选模式
  isSelected?: boolean  // 是否被选中
  onLongPress?: (segmentId: string) => void  // 长按事件
  onSelect?: (segmentId: string) => void  // 选择事件
}

function SegmentCard({
  segment,
  index,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDelete,
  showDelete = false,
  isReadOnly = false,
  isMultiSelectMode = false,
  isSelected = false,
  onLongPress,
  onSelect
}: Props) {
  const [pressTimer, setPressTimer] = useState<number | null>(null)

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation() // 阻止事件冒泡到卡片的 onClick
    if (onDelete) {
      onDelete(segment.id)
    }
  }

  const handleMouseDown = () => {
    // 如果已经处于多选模式，不需要长按
    if (isMultiSelectMode) return

    // 只读模式下不允许长按
    if (isReadOnly) return

    const timer = window.setTimeout(() => {
      if (onLongPress) {
        onLongPress(segment.id)
      }
    }, 800)

    setPressTimer(timer)
  }

  const handleMouseUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer)
      setPressTimer(null)
    }
  }

  const handleMouseLeave = () => {
    // 离开时也要清除计时器
    if (pressTimer) {
      clearTimeout(pressTimer)
      setPressTimer(null)
    }
    onMouseLeave()
  }

  const handleClick = () => {
    if (isMultiSelectMode) {
      // 多选模式下点击触发选择
      if (onSelect) {
        onSelect(segment.id)
      }
    } else {
      // 普通模式下触发原有的 onClick
      onClick()
    }
  }

  return (
    <Card
      size="small"
      className={`mb-2 cursor-pointer transition-all duration-200 w-full relative ${
        isSelected
          ? 'bg-blue-100 border-blue-500 shadow-md'
          : isHovered
          ? 'bg-blue-50 border-blue-400 shadow-md'
          : segment.isModified
            ? 'bg-red-50 border-red-200 hover:border-red-400'
            : 'bg-white border-gray-200 hover:border-gray-400'
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      styles={{ body: { padding: '8px 12px' } }}
    >
      {/* 删除按钮 - 右上角悬停显示 */}
      {showDelete && isHovered && (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={handleDelete}
          className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs bg-white border border-gray-300 rounded-full shadow-sm hover:bg-red-50 hover:border-red-300 z-10"
        />
      )}

      <div className="flex gap-2" style={{ minHeight: '2.5rem' }}>
        {/* 复选框 - 多选模式下显示 */}
        {isMultiSelectMode && (
          <div className="flex-shrink-0 flex items-start pt-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect?.(segment.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 cursor-pointer"
            />
          </div>
        )}

        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* 菱形标识 - 有译文或附注时显示 */}
              {(segment.translatedText || (segment.notes && segment.notes.length > 0)) && (
                <span className="flex-shrink-0 inline-block w-1.5 h-1.5 bg-blue-500 transform rotate-45 rounded-[1px]" />
              )}
              <span className="text-xs text-gray-500 font-medium">
                段落 {index + 1}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {segment.textLength !== undefined && (
                <span className="text-xs text-gray-400">
                  {segment.textLength} 字符
                </span>
              )}
              {/* 书签按钮 */}
              {isReadOnly && <BookmarkButton segmentId={segment.id} isReadOnly={isReadOnly} />}
            </div>
          </div>
          {segment.preview && (
            <div
              className="text-sm text-gray-800 overflow-hidden w-full"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.5rem',
                height: '1.5rem',
                minHeight: '1.5rem'
              }}
            >
              {segment.preview}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export default SegmentCard
