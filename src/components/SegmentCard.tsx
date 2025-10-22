/**
 * 分段卡片组件
 * 显示单个段落的预览（通过xpath从XHTML动态读取内容）
 */

import { Card } from 'antd'
import { useEffect, useState } from 'react'
import { Segment } from '../types/segment'
import { useProjectStore } from '../store/projectStore'

interface Props {
  segment: Segment
  index: number
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
}

function SegmentCard({ segment, index, isHovered, onMouseEnter, onMouseLeave, onClick }: Props) {
  const [text, setText] = useState<string>('')
  const { currentProject } = useProjectStore()

  useEffect(() => {
    // 从 XHTML 中读取分段文本
    const loadText = async () => {
      try {
        console.log('SegmentCard: 开始加载文本', { projectId: currentProject?.id, xpath: segment.xpath })

        if (!currentProject) {
          console.warn('SegmentCard: 项目未初始化')
          return
        }

        if (!window.electronAPI?.getSegmentText) {
          console.warn('SegmentCard: getSegmentText API 不可用')
          return
        }

        const result = await window.electronAPI.getSegmentText(
          currentProject.id,
          segment.chapterHref,
          segment.xpath
        )

        console.log('SegmentCard: API 返回结果', result)

        if (result.success && result.data?.text) {
          console.log('SegmentCard: 文本已加载', { length: result.data.text.length })
          setText(result.data.text)
        } else {
          console.warn('SegmentCard: 获取文本失败或为空', result)
        }
      } catch (error) {
        console.error('SegmentCard: 加载分段文本异常', error)
      }
    }

    loadText()
  }, [segment.id, currentProject?.id])

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
          {text && (
            <span className="text-xs text-gray-400">
              {text.length} 字符
            </span>
          )}
        </div>
        {/* 固定显示一行文本，超出部分用省略号表示 */}
        {text && (
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
            {text}
          </div>
        )}
      </div>
    </Card>
  )
}

export default SegmentCard
