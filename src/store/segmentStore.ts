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

  // 编辑来源（区分按钮组）
  // 'segment': 通过分割/重新分割进入 → 显示"接受、取消"
  // 'edit': 通过编辑按钮进入 → 显示"保存、取消、重新分割"
  // null: 只读模式
  editSource: 'segment' | 'edit' | null

  // 待删除的分段ID列表（点击保存时才真正删除）
  deletedSegmentIds: string[]

  // 待合并的段落列表（点击保存时才真正合并）
  pendingMerges: Array<{
    targetId: string      // 合并到的目标段落ID
    sourceIds: string[]   // 被合并的源段落IDs
    endXPath: string      // 结束段落的XPath
    mergedCfiRanges: string[] // 合并后的CFI列表
    textLength: number    // 合并后的文本长度
  }>

  // 附注列表滚动位置
  segmentScrollTop: number

  // 多选模式相关
  isMultiSelectMode: boolean
  selectedSegmentIds: Set<string>

  // Actions
  setSegments: (segments: Segment[]) => void
  updateSegmentContent: (segmentId: string, translatedText: string | null, notes: any[] | null) => void
  setHoveredSegment: (id: string | null) => void
  setSelectedSegment: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setParsed: (parsed: boolean) => void
  setEditMode: (editMode: boolean) => void
  setEditSource: (source: 'segment' | 'edit' | null) => void
  setActiveChapter: (chapterId: string | null, chapterHref: string) => void
  setChaptersWithSegments: (chapters: string[]) => void
  addChapterWithSegments: (chapterHref: string) => void
  removeChapterWithSegments: (chapterHref: string) => void
  markSegmentDeleted: (segmentId: string) => void
  addPendingMerge: (merge: {
    targetId: string
    sourceIds: string[]
    endXPath: string
    mergedCfiRanges: string[]
    textLength: number
  }) => void
  clearSegments: () => void
  clearModifiedFlags: () => void
  saveScrollPosition: (scrollTop: number) => void
  setMultiSelectMode: (enabled: boolean) => void
  toggleSegmentSelection: (segmentId: string) => void
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
  editSource: null,
  deletedSegmentIds: [],
  pendingMerges: [],
  segmentScrollTop: 0,
  isMultiSelectMode: false,
  selectedSegmentIds: new Set<string>(),

  setSegments: (segments) => {
    const visibleSegments = segments.filter(s => !s.isEmpty)
    set({ segments, visibleSegments })
  },

  updateSegmentContent: (segmentId, translatedText, notes) => {
    const segments = get().segments.map(s =>
      s.id === segmentId
        ? { ...s, translatedText, notes, isModified: true }
        : s
    )
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

  setEditSource: (source) =>
    set({ editSource: source }),

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

  removeChapterWithSegments: (chapterHref) => {
    if (!chapterHref) return
    const next = new Set(get().chaptersWithSegments)
    next.delete(chapterHref)
    set({ chaptersWithSegments: next })
  },

  markSegmentDeleted: (segmentId) => {
    // 从 segments 和 visibleSegments 中移除
    const segments = get().segments.filter(s => s.id !== segmentId)
    const visibleSegments = segments.filter(s => !s.isEmpty)
    // 添加到待删除列表
    const deletedSegmentIds = [...get().deletedSegmentIds, segmentId]
    set({ segments, visibleSegments, deletedSegmentIds })
  },

  addPendingMerge: (merge) => {
    const { targetId, sourceIds, endXPath, mergedCfiRanges, textLength } = merge

    // 更新目标段落：标记为已修改，更新 endXPath、完整合并CFI 和 textLength
    const segments = get().segments.map(s => {
      if (s.id === targetId) {
        return {
          ...s,
          endXPath,
          cfiRanges: mergedCfiRanges,
          textLength,
          isModified: true
        }
      }
      return s
    })

    // 从列表中隐藏被合并的源段落
    const visibleSegments = segments.filter(s => !s.isEmpty && !sourceIds.includes(s.id))

    // 添加到待合并列表
    const pendingMerges = [...get().pendingMerges, merge]

    set({ segments, visibleSegments, pendingMerges })
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
      isEditMode: false,
      editSource: null,
      deletedSegmentIds: [],
      pendingMerges: []
    }),

  clearModifiedFlags: () => {
    const segments = get().segments.map(s => ({ ...s, isModified: false }))
    const visibleSegments = segments.filter(s => !s.isEmpty)
    set({ segments, visibleSegments, deletedSegmentIds: [], pendingMerges: [] })
  },

  saveScrollPosition: (scrollTop: number) => {
    set({ segmentScrollTop: scrollTop })
  },

  setMultiSelectMode: (enabled: boolean) => {
    if (!enabled) {
      set({ isMultiSelectMode: false, selectedSegmentIds: new Set() })
    } else {
      set({ isMultiSelectMode: true })
    }
  },

  toggleSegmentSelection: (segmentId: string) => {
    const selected = new Set(get().selectedSegmentIds)
    if (selected.has(segmentId)) {
      selected.delete(segmentId)
    } else {
      selected.add(segmentId)
    }
    set({ selectedSegmentIds: selected })
  }
}))
