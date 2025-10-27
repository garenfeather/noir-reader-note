/**
 * 段落详情组件
 * 显示段落的完整信息（第一次点击时从XHTML读取并缓存）
 */

import { Button, Spin } from 'antd'
import { ArrowLeftOutlined, TranslationOutlined, PlusOutlined } from '@ant-design/icons'
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
  const [translatedText, setTranslatedText] = useState<string | null>(segment.translatedText || null)
  const [notes, setNotes] = useState<Note[] | null>(segment.notes || null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [originalSegment] = useState(segment) // 保存原始segment用于比较
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
    // 与原始segment比较，而不是当前传入的segment
    const translationChanged = translatedText !== (originalSegment.translatedText || null)
    const notesChanged = JSON.stringify(notes) !== JSON.stringify(originalSegment.notes || null)
    const changed = translationChanged || notesChanged
    setHasChanges(changed)

    // 只在编辑模式且有真正变更时才更新 store
    if (allowEdit && changed) {
      updateSegmentContent(segment.id, translatedText, notes)
    }
  }, [translatedText, notes, originalSegment, segment.id, allowEdit, updateSegmentContent])

  // 处理翻译
  const handleTranslate = async () => {
    try {
      if (!text) {
        return
      }

      if (!window.electronAPI?.translateSegment) {
        return
      }

      setIsTranslating(true)

      const result = await window.electronAPI.translateSegment(text)

      if (result.success && result.data) {
        setTranslatedText(result.data.translatedText)
        // 追加新附注到现有附注列表
        const newNotes = [...(notes || []), ...result.data.notes]
        setNotes(newNotes)
      }
    } catch (error) {
      console.error('翻译异常:', error)
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
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">段落 {index + 1}</h3>
          {hasChanges && (
            <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm" title="有未保存的变更"></span>
          )}
        </div>
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
          externalAddTrigger={isAddingNote}
          onAddComplete={() => setIsAddingNote(false)}
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
            {(!notes || notes.length === 0) && (
              <Button
                icon={<PlusOutlined />}
                onClick={() => setIsAddingNote(true)}
              >
                添加附注
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SegmentDetail
