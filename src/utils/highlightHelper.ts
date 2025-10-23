/**
 * 高亮辅助工具函数
 * 用于在 epub.js 的 iframe 中定位元素和添加高亮效果
 */

import { Rendition } from 'epubjs'

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
    const contents = rendition.getContents()
    if (!contents || contents.length === 0) {
      console.warn('findElementInRendition: 无法获取 contents')
      return null
    }

    const doc = contents[0].document
    if (!doc) {
      console.warn('findElementInRendition: 无法获取 document')
      return null
    }

    const element = findElementByXPath(xpath, doc)

    if (!element) {
      console.group('❌ XPath 定位失败')
      console.error('XPath:', xpath)
      console.error('Rendition 状态:', rendition ? '已加载' : '未加载')
      console.error('iframe Document:', doc ? '存在' : '不存在')
      console.error('可能原因:')
      console.error('  1. XPath 与 iframe DOM 结构不匹配')
      console.error('  2. 元素不在当前页面')
      console.error('建议: 检查 XPath 生成逻辑或使用 CFI 跨页跳转')
      console.groupEnd()
    }

    return element
  } catch (error) {
    console.error('findElementInRendition: 查找失败', error)
    return null
  }
}

/**
 * 添加高亮 CSS 类
 * @param element - DOM 元素
 * @param className - CSS 类名
 */
export function addHighlight(element: Element, className: string): void {
  element.classList.add(className)
}

/**
 * 移除高亮 CSS 类
 * @param element - DOM 元素
 * @param className - CSS 类名
 */
export function removeHighlight(element: Element, className: string): void {
  element.classList.remove(className)
}

/**
 * 添加闪烁高亮效果（自动消失）
 * 使用 CSS Animation，监听 animationend 事件自动移除类名
 * @param element - DOM 元素
 */
export function addFlashHighlight(element: Element): void {
  const className = 'segment-flash-highlight'

  // 添加高亮类
  element.classList.add(className)

  // 监听动画结束事件，自动移除类名
  const handleAnimationEnd = () => {
    element.classList.remove(className)
    element.removeEventListener('animationend', handleAnimationEnd)
  }

  element.addEventListener('animationend', handleAnimationEnd)
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
