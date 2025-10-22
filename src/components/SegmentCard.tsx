/**
 * 分段卡片组件
 * 显示单个段落的预览文字（从数据库加载）
 */

import { Card } from 'antd'
import { Segment } from '../types/segment'

interface Props {
  segment: Segment
  index: number
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
}

function SegmentCard({ segment, index, isHovered, onMouseEnter, onMouseLeave, onClick }: Props) {
  return (
    <Card
      size="small"
      className={`mb-2 cursor-pointer transition-all duration-200 w-full ${
        isHovered
          ? 'bg-blue-50 border-blue-400 shadow-md'
          : 'bg-white border-gray-200 hover:border-gray-400'
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      bodyStyle={{ padding: '8px 12px' }}
    >
      <div className="flex flex-col gap-1" style={{ minHeight: '2.5rem' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">
            段落 {index + 1}
          </span>
          {segment.preview && (
            <span className="text-xs text-gray-400">
              {segment.preview.replace(/\.\.\.$/, '').length} 字符
            </span>
          )}
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
