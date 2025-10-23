/**
 * 高亮辅助工具函数
 * 用于在 epub.js 的 iframe 中定位元素和添加高亮效果
 */

import { Rendition } from 'epubjs'

const ANNOTATION_HOVER_CLASS = 'segment-annot-hover'
const ANNOTATION_FLASH_CLASS = 'segment-annot-flash'
const DOM_HOVER_CLASS = 'segment-hover-highlight'
const DOM_FLASH_CLASS = 'segment-flash-highlight'
const FLASH_HIGHLIGHT_DURATION = 1500

/**
 * 高亮样式 CSS
 * 注入至 epub.js iframe, 为 DOM 兜底高亮提供样式
 */
const HIGHLIGHT_STYLES = `
  /* iframe 内 DOM 兜底样式 */
  .${DOM_HOVER_CLASS} {
    background-image: linear-gradient(
      to bottom,
      transparent 35%,
      rgba(59, 130, 246, 0.3) 35%,
      rgba(59, 130, 246, 0.3) 90%,
      transparent 90%
    ) !important;
    background-size: 100% calc(1em + 6px) !important;
    background-position: 0 0.35em !important;
    background-repeat: repeat-y !important;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    padding: 0 0.15em !important;
    border-radius: 2px;
    transition: background-image 0.2s ease, box-shadow 0.2s ease;
  }

  .${DOM_FLASH_CLASS} {
    background-image: linear-gradient(
      to bottom,
      transparent 35%,
      rgba(59, 130, 246, 0.55) 35%,
      rgba(59, 130, 246, 0.55) 90%,
      transparent 90%
    ) !important;
    background-size: 100% calc(1em + 6px) !important;
    background-position: 0 0.35em !important;
    background-repeat: repeat-y !important;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    padding: 0 0.15em !important;
    border-radius: 2px;
    animation: flashUnderline 1.5s ease-out forwards;
  }

  @keyframes flashUnderline {
    0% {
      background-image: linear-gradient(
        to bottom,
        transparent 35%,
        rgba(59, 130, 246, 0.75) 35%,
        rgba(59, 130, 246, 0.75) 90%,
        transparent 90%
      );
      box-shadow: inset 0 -0.25em 0 rgba(59, 130, 246, 0.35);
    }
    100% {
      background-image: linear-gradient(
        to bottom,
        transparent 35%,
        rgba(59, 130, 246, 0) 35%,
        rgba(59, 130, 246, 0) 90%,
        transparent 90%
      );
      box-shadow: inset 0 -0.25em 0 rgba(59, 130, 246, 0);
    }
  }

  /* epub.js 注解高亮样式 */
  .${ANNOTATION_HOVER_CLASS} {
    mix-blend-mode: multiply;
  }

  .${ANNOTATION_HOVER_CLASS} rect {
    fill: rgba(59, 130, 246, 0.32);
    transition: fill-opacity 0.2s ease;
  }

  .${ANNOTATION_FLASH_CLASS} {
    mix-blend-mode: multiply;
  }

  .${ANNOTATION_FLASH_CLASS} rect {
    fill: rgba(59, 130, 246, 0.55);
    animation: flashHighlight 1.5s ease-out forwards;
  }

  @keyframes flashHighlight {
    0% {
      fill-opacity: 0.95;
    }
    100% {
      fill-opacity: 0;
    }
  }
`

/**
 * 将高亮样式注入到 epub.js 的 iframe 中
 * 应该在 rendition 准备好后调用一次
 * @param rendition - epub.js 的 Rendition 实例
 */
export function injectHighlightStyles(rendition: Rendition | null): void {
  if (!rendition) {
    console.warn('injectHighlightStyles: rendition 为 null')
    return
  }

  try {
    const rawContents = rendition.getContents() as unknown
    if (!Array.isArray(rawContents) || rawContents.length === 0) {
      console.warn('injectHighlightStyles: 无法获取 contents')
      return
    }

    // 注入样式到所有当前加载的 contents
    rawContents.forEach((content: { addStylesheetCss?: (css: string, id?: string) => void }) => {
      try {
        if (typeof content.addStylesheetCss === 'function') {
          content.addStylesheetCss(HIGHLIGHT_STYLES, 'segment-highlight-styles')
        } else {
          console.warn('injectHighlightStyles: content 缺少 addStylesheetCss 方法')
        }
      } catch (error) {
        console.warn('注入高亮样式失败:', error)
      }
    })

    console.log('✅ 高亮样式已注入到 epub.js iframe', rawContents.length, 'pages')
  } catch (error) {
    console.error('injectHighlightStyles: 注入失败', error)
  }
}

/**
 * 监听 rendition 的 rendered 事件,自动注入样式到新加载的页面
 * @param rendition - epub.js 的 Rendition 实例
 */
const renderedRenditions = new WeakSet<Rendition>()

export function setupStyleInjection(rendition: Rendition | null): void {
  if (!rendition) return

  // 先对当前已加载内容注入一次样式
  injectHighlightStyles(rendition)

  if (renderedRenditions.has(rendition)) {
    return
  }

  // 监听页面渲染事件,为新页面注入样式
  const handleRendered = () => {
    injectHighlightStyles(rendition)
  }

  rendition.on('rendered', handleRendered)
  renderedRenditions.add(rendition)
}

function getAnnotations(rendition: Rendition | null) {
  if (!rendition) return null

  const annotations = (rendition as unknown as { annotations?: any }).annotations
  if (!annotations) {
    console.warn('getAnnotations: 当前 rendition 不支持注解')
    return null
  }

  return annotations
}

const HOVER_HIGHLIGHT_STYLES = {
  fill: 'rgba(59, 130, 246, 0.32)',
  'fill-opacity': '0.32',
  'mix-blend-mode': 'multiply',
  rx: '3',
  ry: '2'
}

const FLASH_HIGHLIGHT_STYLES = {
  fill: 'rgba(59, 130, 246, 0.55)',
  'fill-opacity': '0.55',
  'mix-blend-mode': 'multiply',
  rx: '3',
  ry: '2'
}

/**
 * 使用 epub.js 注解高亮指定的 CFI 范围
 */
export function applyHoverHighlightByCfi(
  rendition: Rendition | null,
  cfiRange: string | null | undefined
): void {
  if (!rendition || !cfiRange) return

  const annotations = getAnnotations(rendition)
  if (!annotations) return

  try {
    annotations.remove(cfiRange, 'highlight')
    annotations.highlight(
      cfiRange,
      { highlightType: 'hover' },
      undefined,
      ANNOTATION_HOVER_CLASS,
      HOVER_HIGHLIGHT_STYLES
    )
  } catch (error) {
    console.warn('applyHoverHighlightByCfi: 高亮失败', cfiRange, error)
  }
}

/**
 * 移除指定 CFI 的注解高亮
 */
export function removeHighlightByCfi(
  rendition: Rendition | null,
  cfiRange: string | null | undefined
): void {
  if (!rendition || !cfiRange) return

  const annotations = getAnnotations(rendition)
  if (!annotations) return

  try {
    annotations.remove(cfiRange, 'highlight')
  } catch (error) {
    console.warn('removeHighlightByCfi: 移除失败', cfiRange, error)
  }
}

/**
 * 添加一次性闪烁高亮，自动在持续时间后移除
 * 返回清理函数，可在高亮完成前手动取消
 */
export function flashHighlightByCfi(
  rendition: Rendition | null,
  cfiRange: string | null | undefined,
  duration = FLASH_HIGHLIGHT_DURATION
): () => void {
  if (!rendition || !cfiRange) {
    return () => {}
  }

  const annotations = getAnnotations(rendition)
  if (!annotations) {
    return () => {}
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const cleanup = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
    removeHighlightByCfi(rendition, cfiRange)
  }

  try {
    annotations.remove(cfiRange, 'highlight')
    annotations.highlight(
      cfiRange,
      { highlightType: 'flash' },
      undefined,
      ANNOTATION_FLASH_CLASS,
      FLASH_HIGHLIGHT_STYLES
    )

    timeoutId = setTimeout(() => {
      cleanup()
    }, duration)
  } catch (error) {
    console.warn('flashHighlightByCfi: 高亮失败', cfiRange, error)
  }

  return cleanup
}

/**
 * DOM 兜底：添加/移除悬停高亮
 */
export function addDomHoverHighlight(element: Element): void {
  element.classList.add(DOM_HOVER_CLASS)
}

export function removeDomHoverHighlight(element: Element): void {
  element.classList.remove(DOM_HOVER_CLASS)
}

/**
 * DOM 兜底：添加闪烁高亮
 */
export function addDomFlashHighlight(element: Element): void {
  element.classList.add(DOM_FLASH_CLASS)

  const handleAnimationEnd = () => {
    element.classList.remove(DOM_FLASH_CLASS)
    element.removeEventListener('animationend', handleAnimationEnd)
  }

  element.addEventListener('animationend', handleAnimationEnd)
}

/**
 * 通过 XPath 在 Document 中查找元素
 * @param xpath - XPath 路径
 * @param doc - Document 对象
 * @returns 找到的元素或 null
 */
export function findElementByXPath(xpath: string, doc: Document): Element | null {
  try {
    const result = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    )
    return result.singleNodeValue as Element | null
  } catch (error) {
    console.error('XPath 查找失败:', xpath, error)
    return null
  }
}

/**
 * 在 epub.js 的 rendition 中查找元素
 * @param xpath - XPath 路径
 * @param rendition - epub.js 的 Rendition 实例
 * @returns 找到的元素或 null
 */
export function findElementInRendition(
  xpath: string,
  rendition: Rendition | null
): Element | null {
  if (!rendition) {
    console.warn('findElementInRendition: rendition 为 null')
    return null
  }

  try {
    const rawContents = rendition.getContents() as unknown
    if (!Array.isArray(rawContents) || rawContents.length === 0) {
      console.warn('findElementInRendition: 无法获取 contents')
      return null
    }

    for (const content of rawContents as Array<{ document?: Document }>) {
      const doc = content?.document
      if (!doc) continue

      const element = findElementByXPath(xpath, doc)
      if (element) {
        console.log('✅ XPath 定位成功:', xpath, '->', element.tagName)
        return element
      }
    }

    console.group('❌ XPath 定位失败')
    console.error('XPath:', xpath)
    console.error('Rendition 状态:', rendition ? '已加载' : '未加载')
    console.error('可能原因:')
    console.error('  1. XPath 与 iframe DOM 结构不匹配')
    console.error('  2. 元素不在当前页面')
    console.error('建议: 检查 XPath 生成逻辑或使用 CFI 跨页跳转')
    console.groupEnd()

    return null
  } catch (error) {
    console.error('findElementInRendition: 查找失败', error)
    return null
  }
}

/**
 * 滚动到元素位置
 * @param element - DOM 元素
 */
export function scrollToElement(element: Element): void {
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  })
}
