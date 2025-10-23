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
    console.log('🚀 TranslationPanel: handleAccept 被调用')
    console.log('📊 准备保存的数据:', {
      allowEditing,
      currentProject: currentProject?.id,
      currentChapterId,
      segmentsCount: segments.length,
      firstSegment: segments[0]
    })

    if (!allowEditing) {
      console.warn('⚠️ allowEditing 为 false，退出')
      return
    }
    if (!currentProject || !currentChapterId) {
      message.error('项目信息缺失')
      console.error('❌ 项目信息缺失')
      return
    }

    try {
      console.log('📤 调用 window.electronAPI.saveSegments...')
      const result = await window.electronAPI.saveSegments(
        currentProject.id,
        segments
      )
      console.log('📥 saveSegments 返回结果:', result)

      if (result.success) {
        message.success(`已保存 ${segments.length} 个分段`)
        setHasUnsavedChanges(false)
        if (currentChapterHref) {
          addChapterWithSegments(currentChapterHref)
        }

        // 保存成功后，从数据库重新加载带 CFI 的数据
        console.log('📥 保存成功，重新加载带 CFI 的数据...')
        try {
          const loadResult = await window.electronAPI.loadSegments(
            currentProject.id,
            currentChapterId
          )
          console.log('📥 loadSegments 返回:', loadResult)

          if (loadResult.success && loadResult.data) {
            const { setSegments } = useSegmentStore.getState()
            setSegments(loadResult.data)
            console.log('✅ 已更新 segments，CFI 数据已加载')
          }
        } catch (error) {
          console.error('❌ 重新加载分段失败:', error)
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
