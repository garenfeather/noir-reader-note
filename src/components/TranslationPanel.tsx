/**
 * 附注面板组件
 * 显示分段结果和编辑功能
 */

import { Empty, message } from 'antd'
import { useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useSegmentStore } from '../store/segmentStore'
import SegmentList from './SegmentList'

interface Props {
  mode: 'read' | 'translate'
  currentChapterId?: string
  currentChapterHref?: string
}

function TranslationPanel({ mode, currentChapterId, currentChapterHref }: Props) {
  const { currentProject, setHasUnsavedChanges } = useProjectStore()
  const {
    segments,
    isParsed,
    clearSegments,
    addChapterWithSegments,
    isEditMode,
    setEditMode
  } = useSegmentStore()

  const allowEditing = mode === 'translate'

  useEffect(() => {
    if (!allowEditing && isEditMode) {
      setEditMode(false)
    }
  }, [allowEditing, isEditMode, setEditMode])

  // 接受分段结果
  const handleAccept = async () => {
    if (!allowEditing) return
    if (!currentProject || !currentChapterId) {
      message.error('项目信息缺失')
      return
    }

    try {
      const result = await window.electronAPI.saveSegments(
        currentProject.id,
        segments
      )

      if (result.success) {
        message.success(`已保存 ${segments.length} 个分段`)
        setHasUnsavedChanges(false)
        if (currentChapterHref) {
          addChapterWithSegments(currentChapterHref)
        }
      } else {
        message.error('保存失败: ' + result.error)
      }
    } catch (error) {
      console.error('保存分段失败:', error)
      message.error('保存失败')
    }
  }

  // 丢弃分段结果
  const handleDiscard = () => {
    if (!allowEditing) return
    clearSegments()
    setHasUnsavedChanges(false)
    message.info('已丢弃分段结果')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="font-semibold">附注</h3>
      </div>

      <div className="flex-1 overflow-hidden">
        {isParsed ? (
          <SegmentList
            onAccept={handleAccept}
            onDiscard={handleDiscard}
            allowEditing={allowEditing}
            mode={mode}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Empty description={allowEditing ? '点击顶部「分割」按钮开始分段' : '当前章节暂无附注'} />
          </div>
        )}
      </div>
    </div>
  )
}

export default TranslationPanel
