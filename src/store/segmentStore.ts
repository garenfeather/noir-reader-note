/**
 * 分段状态管理
 */

import { create } from 'zustand'
import { Segment } from '../types/segment'

interface SegmentState {
  // 当前章节的所有分段（包括空段落）
  segments: Segment[]

  // 显示的分段（过滤掉空段落）
  visibleSegments: Segment[]

  // 当前激活的章节
  activeChapterId: string | null
  activeChapterHref: string

  // 已经保存分段结果的章节 href 集合
  chaptersWithSegments: Set<string>

  // 当前高亮的分段ID
  hoveredSegmentId: string | null

  // 当前选中的分段ID（用于详情展示）
  selectedSegmentId: string | null

  // 是否正在加载
  isLoading: boolean

  // 是否已解析
  isParsed: boolean

  // 是否处于编辑模式
  isEditMode: boolean

  // Actions
  setSegments: (segments: Segment[]) => void
  addSegment: (segment: Segment) => void
  updateSegment: (id: string, updates: Partial<Segment>) => void
  removeSegment: (id: string) => void
  splitSegment: (segmentId: string, newSegments: Segment[]) => void
  setHoveredSegment: (id: string | null) => void
  setSelectedSegment: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setParsed: (parsed: boolean) => void
  setEditMode: (editMode: boolean) => void
  setActiveChapter: (chapterId: string | null, chapterHref: string) => void
  setChaptersWithSegments: (chapters: string[]) => void
  addChapterWithSegments: (chapterHref: string) => void
  clearSegments: () => void
}

export const useSegmentStore = create<SegmentState>((set, get) => ({
  segments: [],
  visibleSegments: [],
  activeChapterId: null,
  activeChapterHref: '',
  chaptersWithSegments: new Set<string>(),
  hoveredSegmentId: null,
  selectedSegmentId: null,
  isLoading: false,
  isParsed: false,
  isEditMode: false,

  setSegments: (segments) => {
    const visibleSegments = segments.filter(s => !s.isEmpty)
    set({ segments, visibleSegments })
  },

  addSegment: (segment) => {
    const segments = [...get().segments, segment]
    const visibleSegments = segments.filter(s => !s.isEmpty)
    set({ segments, visibleSegments })
  },

  updateSegment: (id, updates) => {
    const segments = get().segments.map(s =>
      s.id === id ? { ...s, ...updates } : s
    )
    const visibleSegments = segments.filter(s => !s.isEmpty)
    set({ segments, visibleSegments })
  },

  removeSegment: (id) => {
    const segments = get().segments.filter(s => s.id !== id)
    const visibleSegments = segments.filter(s => !s.isEmpty)
    set({ segments, visibleSegments })
  },

  splitSegment: (segmentId, newSegments) => {
    const segments = get().segments.reduce((acc, segment) => {
      if (segment.id === segmentId) {
        // 替换为新分段
        return [...acc, ...newSegments]
      }
      return [...acc, segment]
    }, [] as Segment[])

    const visibleSegments = segments.filter(s => !s.isEmpty)
    set({ segments, visibleSegments })
  },

  setHoveredSegment: (id) =>
    set({ hoveredSegmentId: id }),

  setSelectedSegment: (id) =>
    set({ selectedSegmentId: id }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setParsed: (parsed) =>
    set({ isParsed: parsed }),

  setEditMode: (editMode) =>
    set({ isEditMode: editMode }),

  setActiveChapter: (chapterId, chapterHref) =>
    set({
      activeChapterId: chapterId,
      activeChapterHref: chapterHref
    }),

  setChaptersWithSegments: (chapters) =>
    set({ chaptersWithSegments: new Set(chapters) }),

  addChapterWithSegments: (chapterHref) => {
    if (!chapterHref) return
    const next = new Set(get().chaptersWithSegments)
    next.add(chapterHref)
    set({ chaptersWithSegments: next })
  },

  clearSegments: () =>
    set({
      segments: [],
      visibleSegments: [],
      activeChapterId: null,
      activeChapterHref: '',
      hoveredSegmentId: null,
      selectedSegmentId: null,
      isParsed: false,
      isEditMode: false
    })
}))
