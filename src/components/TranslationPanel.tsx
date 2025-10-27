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
  currentChapterId?: string
  currentChapterHref?: string
}

function TranslationPanel({ currentChapterId, currentChapterHref }: Props) {
  const { currentProject, setHasUnsavedChanges } = useProjectStore()
  const {
    segments,
    isParsed,
    clearSegments,
    addChapterWithSegments,
    isEditMode,
    setEditMode,
    chaptersWithSegments,
    setSegments,
    setLoading,
    setParsed,
    deletedSegmentIds,
    clearModifiedFlags
  } = useSegmentStore()

  // 始终允许操作，通过 isEditMode 控制编辑/只读
  const allowEditing = true

  // 判断当前章节是否有持久化结果
  const hasPersisted = currentChapterHref ? chaptersWithSegments.has(currentChapterHref) : false

  // 检测分段是否有修改
  const hasSegmentChanges = (): boolean => {
    // 检查是否有标记为修改的分段
    const hasModifiedSegments = segments.some(s => s.isModified === true)
    // 检查是否有待删除的分段
    const hasDeletedSegments = deletedSegmentIds.length > 0

    return hasModifiedSegments || hasDeletedSegments
  }

  // 移除 allowEditing 检查，编辑模式由底部按钮控制

  // 接受分段结果
  const handleAccept = async () => {
    console.log('🚀 TranslationPanel: handleAccept 被调用')

    if (!allowEditing) {
      console.warn('⚠️ allowEditing 为 false，退出')
      return
    }
    if (!currentProject || !currentChapterId) {
      message.error('项目信息缺失')
      console.error('❌ 项目信息缺失')
      return
    }

    // 检测是否有修改
    const hasChanges = hasSegmentChanges()
    console.log('📊 检测分段修改:', { hasChanges, hasPersisted })

    // 如果没有修改，直接退出编辑模式
    if (!hasChanges && hasPersisted) {
      console.log('✅ 无修改，直接退出编辑模式')
      return
    }

    try {
      // 1. 先删除标记删除的分段
      if (deletedSegmentIds.length > 0) {
        console.log('🗑️ 开始删除标记的分段:', deletedSegmentIds)
        for (const segmentId of deletedSegmentIds) {
          try {
            const deleteResult = await window.electronAPI.deleteSegment(segmentId)
            if (!deleteResult.success) {
              console.warn('删除分段失败:', segmentId, deleteResult.error)
            }
          } catch (error) {
            console.error('删除分段异常:', segmentId, error)
          }
        }
        console.log('✅ 已删除 ' + deletedSegmentIds.length + ' 个分段')
      }

      // 2. 保存当前分段列表（清除 isModified 标记）
      const segmentsToSave = segments.map(s => ({ ...s, isModified: false }))
      console.log('📤 调用 window.electronAPI.saveSegments...')
      const result = await window.electronAPI.saveSegments(
        currentProject.id,
        segmentsToSave
      )
      console.log('📥 saveSegments 返回结果:', result)

      if (result.success) {
        message.success(`已保存 ${segments.length} 个分段`)
        setHasUnsavedChanges(false)
        if (currentChapterHref) {
          addChapterWithSegments(currentChapterHref)
        }

        // 立即清除所有修改标记
        clearModifiedFlags()

        // 保存成功后，从数据库重新加载带 CFI 的数据
        console.log('📥 保存成功，重新加载带 CFI 的数据...')
        try {
          const loadResult = await window.electronAPI.loadSegments(
            currentProject.id,
            currentChapterId
          )
          console.log('📥 loadSegments 返回:', loadResult)

          if (loadResult.success && loadResult.data) {
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

  // 取消编辑（恢复到持久化状态）
  const handleCancel = async () => {
    if (!allowEditing) return
    if (!currentProject || !currentChapterId) {
      message.error('项目信息缺失')
      return
    }

    try {
      console.log('📥 取消编辑，从数据库重新加载持久化结果...')
      const result = await window.electronAPI.loadSegments(
        currentProject.id,
        currentChapterId
      )

      if (result.success && result.data) {
        setSegments(result.data)
        setParsed(result.data.length > 0)
        setHasUnsavedChanges(false)
        message.info('已恢复到保存的状态')
        console.log('✅ 已恢复到持久化状态')
      } else {
        message.error('恢复失败: ' + result.error)
      }
    } catch (error) {
      console.error('恢复持久化状态失败:', error)
      message.error('恢复失败')
    }
  }

  // 分割（首次分割）
  const handleSegment = async () => {
    if (!allowEditing) return
    if (!currentProject || !currentChapterId || !currentChapterHref) {
      message.error('项目信息缺失')
      return
    }

    try {
      setLoading(true)
      message.loading('正在分析段落...', 0)

      const result = await window.electronAPI.parseSegments(
        currentProject.id,
        currentChapterId,
        currentChapterHref
      )

      message.destroy()
      setLoading(false)

      if (result.success && result.data) {
        setSegments(result.data.segments)
        setParsed(true)
        setEditMode(true) // 首次分割后进入编辑模式
        setHasUnsavedChanges(true)
        message.success(`分析完成，找到 ${result.data.totalCount} 个段落`)
        console.log('分段结果:', result.data)
      } else {
        message.error('分析失败: ' + result.error)
        setParsed(false)
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      message.destroy()
      setLoading(false)
      console.error('分段失败:', error)
      message.error('分段失败')
      setParsed(false)
      setHasUnsavedChanges(false)
    }
  }

  // 重新分割
  const handleResegment = async () => {
    if (!allowEditing) return
    if (!currentProject || !currentChapterId || !currentChapterHref) {
      message.error('项目信息缺失')
      return
    }

    try {
      setLoading(true)
      message.loading('正在重新分析段落...', 0)

      const result = await window.electronAPI.parseSegments(
        currentProject.id,
        currentChapterId,
        currentChapterHref
      )

      message.destroy()
      setLoading(false)

      if (result.success && result.data) {
        setSegments(result.data.segments)
        setParsed(true)
        setHasUnsavedChanges(true)
        message.success(`重新分析完成，找到 ${result.data.totalCount} 个段落`)
        console.log('重新分段结果:', result.data)
      } else {
        message.error('重新分析失败: ' + result.error)
      }
    } catch (error) {
      message.destroy()
      setLoading(false)
      console.error('重新分段失败:', error)
      message.error('重新分段失败')
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="font-semibold">附注</h3>
      </div>

      <div className="flex-1 overflow-hidden">
        <SegmentList
          onAccept={handleAccept}
          onDiscard={handleDiscard}
          onCancel={handleCancel}
          onResegment={handleResegment}
          onSegment={handleSegment}
          allowEditing={allowEditing}
          hasPersisted={hasPersisted}
        />
      </div>
    </div>
  )
}

export default TranslationPanel
