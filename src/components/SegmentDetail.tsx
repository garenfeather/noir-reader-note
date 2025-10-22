/**
 * 段落详情组件
 * 显示段落的完整信息（通过xpath从XHTML动态读取内容）
 */

import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { Segment } from '../types/segment'
import { useProjectStore } from '../store/projectStore'

interface Props {
  segment: Segment
  index: number
  onBack: () => void
}

function SegmentDetail({ segment, index, onBack }: Props) {
  const [text, setText] = useState<string>('')
  const { currentProject } = useProjectStore()

  useEffect(() => {
    // 从 XHTML 中读取分段文本
    const loadText = async () => {
      try {
        console.log('SegmentDetail: 开始加载文本', { projectId: currentProject?.id, xpath: segment.xpath })

        if (!currentProject) {
          console.warn('SegmentDetail: 项目未初始化')
          return
        }

        if (!window.electronAPI?.getSegmentText) {
          console.warn('SegmentDetail: getSegmentText API 不可用')
          return
        }

        const result = await window.electronAPI.getSegmentText(
          currentProject.id,
          segment.chapterHref,
          segment.xpath
        )

        console.log('SegmentDetail: API 返回结果', result)

        if (result.success && result.data?.text) {
          console.log('SegmentDetail: 文本已加载', { length: result.data.text.length })
          setText(result.data.text)
        } else {
          console.warn('SegmentDetail: 获取文本失败或为空', result)
        }
      } catch (error) {
        console.error('SegmentDetail: 加载分段文本异常', error)
      }
    }

    loadText()
  }, [segment.id, currentProject?.id])

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 顶部导航栏 */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          size="small"
        />
        <h3 className="font-semibold">段落 {index + 1}</h3>
      </div>

      {/* 段落详情内容 */}
      <div className="flex-1 overflow-auto p-4">
        {/* 基本信息 */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <div>段落编号: {index + 1}</div>
            {text && <div>字符数: {text.length}</div>}
            <div>位置: {segment.position}</div>
          </div>
        </div>

        {/* 原文内容 */}
        {text && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">原文</h4>
            <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-200">
              {text}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SegmentDetail
