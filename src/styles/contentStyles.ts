/**
 * 统一的内容样式模块
 * 用于 BookmarkDetail 和 SegmentDetail 的原文、译文、附注显示
 */

/**
 * 通用内容容器样式
 * 用于原文、译文、附注的外层容器
 */
export const contentContainerStyles = 'text-base text-gray-800 leading-relaxed whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-200'

/**
 * 原文容器样式（可点击跳转）
 */
export const originalTextStyles = `${contentContainerStyles} cursor-pointer transition-all hover:border-blue-500 hover:shadow-md`

/**
 * 译文容器样式
 */
export const translationTextStyles = contentContainerStyles

/**
 * 附注容器样式
 */
export const noteItemStyles = contentContainerStyles

/**
 * 附注内容样式
 */
export const noteContentStyles = 'text-base text-gray-800 leading-relaxed whitespace-pre-wrap'
