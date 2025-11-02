/**
 * 书签列表组件
 * 按章节分组显示书签
 */

import { Spin, Empty, Button } from 'antd'
import { DeleteOutlined, FolderOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { useBookmarkStore } from '../store/bookmarkStore'
import { useBookStore } from '../store/bookStore'
import { Bookmark } from '../types/segment'

interface BookmarksByChapter {
  chapterId: string
  chapterHref: string
  bookmarks: Bookmark[]
}

function BookmarkList() {
  const {
    bookmarks,
    isLoading,
    loadBookmarks,
    removeBookmark,
    selectedBookmarkId,
    selectBookmark,
    bookmarkScrollTop,
    saveScrollPosition
  } = useBookmarkStore()

  const { getChapterLabel } = useBookStore()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [hoveredBookmarkId, setHoveredBookmarkId] = useState<number | null>(null)

  // 初始加载书签列表
  useEffect(() => {
    loadBookmarks()
  }, [])

  // 恢复滚动位置
  useEffect(() => {
    if (scrollContainerRef.current && bookmarkScrollTop > 0) {
      scrollContainerRef.current.scrollTop = bookmarkScrollTop
    }
  }, [bookmarkScrollTop])

  // 保存滚动位置
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      saveScrollPosition(scrollContainerRef.current.scrollTop)
    }
  }

  // 按章节分组
  const groupedBookmarks: BookmarksByChapter[] = []
  const chapterMap = new Map<string, BookmarksByChapter>()

  bookmarks.forEach(bookmark => {
    const { chapterId, chapterHref } = bookmark.segment
    if (!chapterMap.has(chapterId)) {
      const group: BookmarksByChapter = {
        chapterId,
        chapterHref,
        bookmarks: []
      }
      chapterMap.set(chapterId, group)
      groupedBookmarks.push(group)
    }
    chapterMap.get(chapterId)!.bookmarks.push(bookmark)
  })

  // 处理删除书签
  const handleDelete = async (segmentId: string) => {
    await removeBookmark(segmentId)
  }

  // 处理点击书签项
  const handleBookmarkClick = (bookmarkId: number) => {
    selectBookmark(bookmarkId)
  }

  // 渲染空状态
  if (!isLoading && bookmarks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Empty
          description="暂无书签"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <p className="text-gray-500 text-sm mt-2">
            点击附注旁的收藏按钮可添加书签
          </p>
        </Empty>
      </div>
    )
  }

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-auto"
      onScroll={handleScroll}
    >
      <Spin spinning={isLoading}>
        <div className="p-4 space-y-6">
          {groupedBookmarks.map(group => (
            <div key={group.chapterId} className="space-y-2">
              {/* 章节标题 - 显示真实章节名 */}
              <div className="flex items-center gap-2 text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                <FolderOutlined />
                <span>{getChapterLabel(group.chapterHref)}</span>
              </div>

              {/* 该章节的书签列表 */}
              <div className="space-y-2">
                {group.bookmarks.map(bookmark => (
                  <div
                    key={bookmark.bookmarkId}
                    className={`
                      relative p-3 border rounded-lg cursor-pointer transition-all
                      ${selectedBookmarkId === bookmark.bookmarkId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'}
                    `}
                    onClick={() => handleBookmarkClick(bookmark.bookmarkId)}
                    onMouseEnter={() => setHoveredBookmarkId(bookmark.bookmarkId)}
                    onMouseLeave={() => setHoveredBookmarkId(null)}
                  >
                    {/* 书签内容 */}
                    <div className="pr-8">
                      <div className="text-sm text-gray-800 line-clamp-3">
                        {bookmark.segment.preview || '（空段落）'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        收藏于 {new Date(bookmark.bookmarkedAt).toLocaleString('zh-CN')}
                      </div>
                    </div>

                    {/* 删除按钮（悬停时显示） */}
                    {hoveredBookmarkId === bookmark.bookmarkId && (
                      <div className="absolute top-2 right-2">
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(bookmark.segment.id)
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Spin>
    </div>
  )
}

export default BookmarkList
