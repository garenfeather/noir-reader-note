/**
 * 书签详情组件
 * 完全只读，显示章节、原文、译文、附注
 */

import { Button, Spin, Card, Space, message } from 'antd'
import { ArrowLeftOutlined, FolderOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { Bookmark } from '../types/segment'
import { useProjectStore } from '../store/projectStore'
import { useBookmarkStore } from '../store/bookmarkStore'
import { useBookStore } from '../store/bookStore'

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
    if (segment.cfiRange) {
      await jumpToCfi(segment.cfiRange)
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
          segment.xpath
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
          <Card
            title="原文"
            size="small"
            className="bg-gray-50 cursor-pointer transition-all hover:border-blue-500 hover:shadow-md"
            onClick={handleOriginalTextClick}
          >
            {isLoading ? (
              <div className="text-center py-4">
                <Spin />
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                {text || '（无内容）'}
              </div>
            )}
          </Card>

          {/* 译文 */}
          {segment.translatedText && (
            <Card
              title="译文"
              size="small"
              className="bg-blue-50"
            >
              <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                {segment.translatedText}
              </div>
            </Card>
          )}

          {/* 附注 */}
          {segment.notes && segment.notes.length > 0 && (
            <Card
              title="附注"
              size="small"
              className="bg-yellow-50"
            >
              <div className="space-y-3">
                {segment.notes.map((note) => (
                  <div key={note.id} className="border-l-2 border-yellow-400 pl-3">
                    <div className="text-gray-800">
                      {note.text}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(note.timestamp).toLocaleString('zh-CN')}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookmarkDetail
