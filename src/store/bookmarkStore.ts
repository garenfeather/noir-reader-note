/**
 * 书签状态管理
 */

import { create } from 'zustand'
import { Bookmark } from '../types/segment'
import { message } from 'antd'

interface BookmarkState {
  // 书签列表（包含segment完整信息）
  bookmarks: Bookmark[]

  // 已收藏的分段ID集合（用于快速查找）
  bookmarkedSegmentIds: Set<string>

  // 当前选中的书签ID
  selectedBookmarkId: number | null

  // 书签列表滚动位置
  bookmarkScrollTop: number

  // 是否正在加载
  isLoading: boolean

  // Actions
  loadBookmarks: () => Promise<void>
  addBookmark: (segmentId: string) => Promise<boolean>
  removeBookmark: (segmentId: string) => Promise<boolean>
  isBookmarked: (segmentId: string) => boolean
  selectBookmark: (bookmarkId: number | null) => void
  saveScrollPosition: (scrollTop: number) => void
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  bookmarkedSegmentIds: new Set<string>(),
  selectedBookmarkId: null,
  bookmarkScrollTop: 0,
  isLoading: false,

  loadBookmarks: async () => {
    set({ isLoading: true })
    try {
      const result = await window.electronAPI.getBookmarks()
      if (result.success) {
        const bookmarks = result.data as Bookmark[]
        const bookmarkedSegmentIds = new Set(bookmarks.map(b => b.segment.id))
        set({ bookmarks, bookmarkedSegmentIds })
      } else {
        console.error('加载书签列表失败:', result.error)
        message.error('加载书签列表失败')
      }
    } catch (error) {
      console.error('加载书签列表异常:', error)
      message.error('加载书签列表失败')
    } finally {
      set({ isLoading: false })
    }
  },

  addBookmark: async (segmentId: string) => {
    try {
      const result = await window.electronAPI.addBookmark(segmentId)
      if (result.success) {
        // 重新加载书签列表
        await get().loadBookmarks()
        message.success('收藏成功')
        return true
      } else {
        console.error('添加书签失败:', result.error)
        if (result.error === '该附注已收藏') {
          message.warning('该附注已收藏')
        } else {
          message.error('收藏失败')
        }
        return false
      }
    } catch (error) {
      console.error('添加书签异常:', error)
      message.error('收藏失败')
      return false
    }
  },

  removeBookmark: async (segmentId: string) => {
    try {
      const result = await window.electronAPI.removeBookmark(segmentId)
      if (result.success) {
        // 重新加载书签列表
        await get().loadBookmarks()
        message.success('已取消收藏')
        return true
      } else {
        console.error('删除书签失败:', result.error)
        message.error('取消收藏失败')
        return false
      }
    } catch (error) {
      console.error('删除书签异常:', error)
      message.error('取消收藏失败')
      return false
    }
  },

  isBookmarked: (segmentId: string) => {
    return get().bookmarkedSegmentIds.has(segmentId)
  },

  selectBookmark: (bookmarkId: number | null) => {
    set({ selectedBookmarkId: bookmarkId })
  },

  saveScrollPosition: (scrollTop: number) => {
    set({ bookmarkScrollTop: scrollTop })
  }
}))
