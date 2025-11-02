/**
 * 分段相关类型定义
 */

/**
 * 附注项
 */
export interface Note {
  id: string                    // 附注ID
  text: string                  // 附注内容
  timestamp: number             // 创建时间戳
}

export interface Segment {
  id: string                    // 分段ID (uuid)
  projectId: string             // 项目ID
  chapterId: string             // 章节ID (spine item id)
  chapterHref: string           // 章节文件路径
  xpath: string                 // XPath路径（用于从XHTML动态读取文本内容）
  endXPath?: string | null      // 合并段落的结束XPath（普通段落为null）
  cfiRanges?: string[] | null   // CFI范围列表（用于定位和高亮）
  position: number              // 在章节中的顺序
  isEmpty: boolean              // 是否为空段落
  parentSegmentId?: string      // 手动分割的父分段ID
  preview?: string              // 预览文字（列表显示用）
  textLength?: number           // 完整文本的字符数
  createdAt?: string            // 创建时间
  // 翻译和附注功能
  originalText?: string         // 原文（临时字段，不持久化，从XHTML动态读取）
  translatedText?: string | null // 译文
  notes?: Note[] | null         // 附注列表
  isModified?: boolean          // 是否被修改过
}

export interface SegmentParseResult {
  segments: Segment[]
  chapterId: string
  chapterHref: string
  totalCount: number            // 总段落数
  emptyCount: number            // 空段落数
}

/**
 * 段落元素信息（用于解析）
 */
export interface ParagraphElement {
  element: Element
  xpath: string
  text: string
  isEmpty: boolean
  index: number
}

/**
 * 书签类型
 */
export interface Bookmark {
  bookmarkId: number            // 书签ID
  bookmarkedAt: string          // 收藏时间
  segment: Segment              // 关联的分段完整信息
}
