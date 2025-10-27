/**
 * 段落详情组件
 * 显示段落的完整信息（第一次点击时从XHTML读取并缓存）
 */

import { Button, Spin, message } from 'antd'
import { ArrowLeftOutlined, TranslationOutlined, SaveOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { Segment, Note } from '../types/segment'
import { useProjectStore } from '../store/projectStore'
import { useSegmentStore } from '../store/segmentStore'
import TranslationSection from './TranslationSection'
import NotesSection from './NotesSection'

interface Props {
  segment: Segment
  index: number
  onBack: () => void
  allowEdit?: boolean // 是否允许编辑（附注模式下的编辑状态）
}

function SegmentDetail({ segment, index, onBack, allowEdit = true }: Props) {
  const [text, setText] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | null>(segment.translatedText || null)
  const [notes, setNotes] = useState<Note[] | null>(segment.notes || null)
  const [hasChanges, setHasChanges] = useState(false)
  const { currentProject } = useProjectStore()
  const { updateSegmentContent } = useSegmentStore()

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

  // 检测数据变化
  useEffect(() => {
    const translationChanged = translatedText !== (segment.translatedText || null)
    const notesChanged = JSON.stringify(notes) !== JSON.stringify(segment.notes || null)
    setHasChanges(translationChanged || notesChanged)
  }, [translatedText, notes, segment])

  // 处理保存
  const handleSave = async () => {
    try {
      if (!hasChanges) {
        message.info('没有需要保存的更改')
        return
      }

      if (!window.electronAPI?.saveSegmentNotes) {
        message.error('保存功能不可用')
        return
      }

      setIsSaving(true)

      const result = await window.electronAPI.saveSegmentNotes(
        segment.id,
        translatedText,
        notes
      )

      if (result.success) {
        message.success('保存成功')
        setHasChanges(false)
        // 更新 store 中的数据
        updateSegmentContent(segment.id, translatedText, notes)
      } else {
        message.error('保存失败: ' + (result.error || '未知错误'))
      }
    } catch (error) {
      console.error('保存失败:', error)
      message.error('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

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
        {isLoading && <Spin size="small" className="ml-auto" />}
      </div>

      {/* 段落详情内容 */}
      <div className="flex-1 overflow-auto p-4">
        {/* 译文区域 */}
        <TranslationSection
          translatedText={translatedText}
          onChange={setTranslatedText}
          allowEdit={allowEdit}
        />

        {/* 附注区域 */}
        <NotesSection
          notes={notes}
          onNotesChange={setNotes}
          allowEdit={allowEdit}
        />

        {/* 原文内容 */}
        {text && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              原文{text.length > 0 && `（字符数 ${text.length}）`}
            </h4>
            <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-200">
              {text}
            </div>
          </div>
        )}
      </div>

      {/* 底部操作按钮 - 只在编辑模式下显示 */}
      {allowEdit && (
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="w-full flex justify-center gap-3">
            <Button
              icon={<TranslationOutlined />}
              onClick={handleTranslate}
              loading={isTranslating}
              disabled={!text || isLoading}
            >
              翻译
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={isSaving}
              disabled={!hasChanges}
            >
              保存
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SegmentDetail
