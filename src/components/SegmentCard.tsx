/**
 * 分段卡片组件
 * 显示单个段落的预览文字（从数据库加载）
 */

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
}

function SegmentCard({ segment, index, isHovered, onMouseEnter, onMouseLeave, onClick, onDelete, showDelete = false, isReadOnly = false }: Props) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation() // 阻止事件冒泡到卡片的 onClick
    if (onDelete) {
      onDelete(segment.id)
    }
  }

  return (
    <Card
      size="small"
      className={`mb-2 cursor-pointer transition-all duration-200 w-full relative ${
        isHovered
          ? 'bg-blue-50 border-blue-400 shadow-md'
          : segment.isModified
            ? 'bg-red-50 border-red-200 hover:border-red-400'
            : 'bg-white border-gray-200 hover:border-gray-400'
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
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

      <div className="flex flex-col gap-1" style={{ minHeight: '2.5rem' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">
            段落 {index + 1}
          </span>
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
    </Card>
  )
}

export default SegmentCard
