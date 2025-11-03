/**
 * 书签详情组件
 * 完全只读，显示章节、原文、译文、附注
 */

import { Button, Spin, message } from 'antd'
import { ArrowLeftOutlined, FolderOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { Bookmark } from '../types/segment'
import { useProjectStore } from '../store/projectStore'
import { useBookStore } from '../store/bookStore'
import { originalTextStyles, translationTextStyles, noteItemStyles, noteContentStyles } from '../styles/contentStyles'

interface Props {
  bookmark: Bookmark
  onBack: () => void
}

function BookmarkDetail({ bookmark, onBack }: Props) {
  const [text, setText] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const { currentProject } = useProjectStore()
  const { jumpToCfi } = useBookStore()

  const { segment } = bookmark

  // 处理原文点击跳转
  const handleOriginalTextClick = async () => {
    const primaryCfi = segment.cfiRanges?.[0]
    if (primaryCfi) {
      await jumpToCfi(primaryCfi)
    } else {
      message.warning('该书签缺少定位信息')
    }
  }

  useEffect(() => {
    // 从 XHTML 中读取分段文本
    const loadText = async () => {
      try {
        if (!currentProject) {
          console.warn('BookmarkDetail: 项目未初始化')
          return
        }

        if (!window.electronAPI?.getSegmentText) {
          console.warn('BookmarkDetail: getSegmentText API 不可用')
          return
        }

        setIsLoading(true)

        const result = await window.electronAPI.getSegmentText(
          currentProject.id,
          segment.chapterHref,
          segment.xpath,
          segment.endXPath || null
        )

        if (result.success && result.data?.text) {
          setText(result.data.text)
        }
      } catch (error) {
        console.error('BookmarkDetail: 加载分段文本异常', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadText()
  }, [segment.id, currentProject?.id])

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 头部 */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
        >
          返回
        </Button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* 章节信息 - 显示真实章节名 */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FolderOutlined />
            <span>{useBookStore.getState().getChapterLabel(segment.chapterHref)}</span>
          </div>

          {/* 收藏时间 */}
          <div className="text-xs text-gray-400">
            收藏于 {new Date(bookmark.bookmarkedAt).toLocaleString('zh-CN')}
          </div>

          {/* 原文 - 可点击跳转 */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              原文{text.length > 0 ? `（字符数 ${text.length}）` : ''}
            </h4>
            {isLoading ? (
              <div className="text-center py-4">
                <Spin />
              </div>
            ) : (
              <div
                className={originalTextStyles}
                onClick={handleOriginalTextClick}
              >
                {text || '（无内容）'}
              </div>
            )}
          </div>

          {/* 译文 */}
          {segment.translatedText && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">译文</h4>
              <div className={translationTextStyles}>
                {segment.translatedText}
              </div>
            </div>
          )}

          {/* 附注 */}
          {segment.notes && segment.notes.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                附注 ({segment.notes.length})
              </h4>
              <div className="space-y-2">
                {segment.notes.map((note) => (
                  <div key={note.id} className={noteItemStyles}>
                    <div className={noteContentStyles}>
                      {note.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookmarkDetail
