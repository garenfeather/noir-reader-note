/**
 * 分段相关类型定义
 */

export interface Segment {
  id: string                    // 分段ID (uuid)
  projectId: string             // 项目ID
  chapterId: string             // 章节ID (spine item id)
  chapterHref: string           // 章节文件路径
  xpath: string                 // XPath路径（用于从XHTML动态读取文本内容）
  cfiRange?: string             // CFI范围（用于定位和高亮）
  position: number              // 在章节中的顺序
  isEmpty: boolean              // 是否为空段落
  parentSegmentId?: string      // 手动分割的父分段ID
  createdAt?: string            // 创建时间
}

export interface SegmentParseResult {
  segments: Segment[]
  chapterId: string
  chapterHref: string
  totalCount: number            // 总段落数
  emptyCount: number            // 空段落数
}

export interface SegmentSplitRequest {
  segmentId: string             // 要分割的分段ID
  splitRange: {
    startOffset: number         // 分割起始位置
    endOffset: number           // 分割结束位置
  }
  selectedText: string          // 选中的文本
}

export interface SegmentHighlight {
  segmentId: string
  cfiRange: string
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
