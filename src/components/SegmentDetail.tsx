/**
 * 段落详情组件
 * 显示段落的完整信息（第一次点击时从XHTML读取并缓存）
 */

import { Button, Spin, message } from 'antd'
import { ArrowLeftOutlined, TranslationOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { Segment, Note } from '../types/segment'
import { useProjectStore } from '../store/projectStore'

interface Props {
  segment: Segment
  index: number
  onBack: () => void
}

function SegmentDetail({ segment, index, onBack }: Props) {
  const [text, setText] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | null>(segment.translatedText || null)
  const [notes, setNotes] = useState<Note[] | null>(segment.notes || null)
  const { currentProject } = useProjectStore()

  useEffect(() => {
    // 从 XHTML 中读取分段文本
    const loadText = async () => {
      try {
        console.log('SegmentDetail: 开始加载文本', {
          projectId: currentProject?.id,
          xpath: segment.xpath
        })

        if (!currentProject) {
          console.warn('SegmentDetail: 项目未初始化')
          return
        }

        if (!window.electronAPI?.getSegmentText) {
          console.warn('SegmentDetail: getSegmentText API 不可用')
          return
        }

        setIsLoading(true)

        const result = await window.electronAPI.getSegmentText(
          currentProject.id,
          segment.chapterHref,
          segment.xpath
        )

        console.log('SegmentDetail: 文本已加载', {
          length: result.data?.text.length,
          fromCache: result.data?.fromCache
        })

        if (result.success && result.data?.text) {
          setText(result.data.text)
        } else {
          console.warn('SegmentDetail: 获取文本失败或为空', result)
        }
      } catch (error) {
        console.error('SegmentDetail: 加载分段文本异常', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadText()
  }, [segment.id, currentProject?.id])

  // 处理翻译
  const handleTranslate = async () => {
    try {
      if (!text) {
        message.warning('原文尚未加载完成')
        return
      }

      if (!window.electronAPI?.translateSegment) {
        message.error('翻译功能不可用')
        return
      }

      setIsTranslating(true)

      const result = await window.electronAPI.translateSegment(text)

      if (result.success && result.data) {
        setTranslatedText(result.data.translatedText)
        // 追加新附注到现有附注列表
        const newNotes = [...(notes || []), ...result.data.notes]
        setNotes(newNotes)
        message.success('翻译完成')
      } else {
        message.error('翻译失败: ' + (result.error || '未知错误'))
      }
    } catch (error) {
      console.error('翻译异常:', error)
      message.error('翻译异常')
    } finally {
      setIsTranslating(false)
    }
  }

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
        <div className="flex-1" />
        <Button
          type="primary"
          icon={<TranslationOutlined />}
          onClick={handleTranslate}
          loading={isTranslating}
          disabled={!text || isLoading}
          size="small"
        >
          翻译
        </Button>
        {isLoading && <Spin size="small" />}
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

        {/* 译文内容 */}
        {translatedText && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">译文</h4>
            <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap p-3 bg-blue-50 rounded border border-blue-200">
              {translatedText}
            </div>
          </div>
        )}

        {/* 附注列表 */}
        {notes && notes.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">附注 ({notes.length})</h4>
            <div className="space-y-2">
              {notes.map((note, idx) => (
                <div
                  key={note.id}
                  className="p-3 bg-yellow-50 rounded border border-yellow-200"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 font-mono">{idx + 1}.</span>
                    <div className="flex-1 text-sm text-gray-800">{note.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
