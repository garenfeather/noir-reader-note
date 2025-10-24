/**
 * 高亮辅助工具函数
 * 使用 epub.js 的 annotations API 实现简单可靠的高亮效果
 */

import { Rendition } from 'epubjs'

const FLASH_HIGHLIGHT_DURATION = 1500

/**
 * 配置 epub.js 的高亮主题样式
 * 使用 rendition.themes API 设置全局样式,无需手动注入
 * @param rendition - epub.js 的 Rendition 实例
 */
const configuredRenditions = new WeakSet<Rendition>()

export function setupHighlightTheme(rendition: Rendition | null): void {
  if (!rendition) {
    console.warn('setupHighlightTheme: rendition 为 null')
    return
  }

  if (configuredRenditions.has(rendition)) {
    return // 避免重复配置
  }

  try {
    // 使用 epub.js 官方推荐的 themes API
    // 参考: node_modules/epubjs/examples/highlights.html:125-132
    rendition.themes.default({
      // 悬停高亮样式 - 浅蓝色半透明
      '.epubjs-hl': {
        'fill': 'rgb(59, 130, 246)',
        'fill-opacity': '0.3',
        'mix-blend-mode': 'multiply'
      }
    })

    configuredRenditions.add(rendition)
    console.log('✅ epub.js 高亮主题已配置')
  } catch (error) {
    console.error('setupHighlightTheme: 配置失败', error)
  }
}

/**
 * 获取 rendition 的 annotations 对象
 */
function getAnnotations(rendition: Rendition | null) {
  if (!rendition) return null

  const annotations = (rendition as unknown as { annotations?: any }).annotations
  if (!annotations) {
    console.warn('getAnnotations: 当前 rendition 不支持注解')
    return null
  }

  return annotations
}

/**
 * 通过 XPath 生成完整的 CFI
 * @param xpath - XPath 路径
 * @param rendition - epub.js 的 Rendition 实例
 * @returns CFI 字符串或 null
 */
export function generateCFIFromXPath(
  xpath: string,
  rendition: Rendition | null
): string | null {
  if (!rendition || !xpath) return null

  try {
    // 1. 在当前渲染的文档中通过 XPath 找到元素
    const element = findElementInRendition(xpath, rendition)
    if (!element) {
      console.warn('generateCFIFromXPath: 未找到元素', xpath)
      return null
    }

    // 2. 获取当前显示的 section
    const rawContents = rendition.getContents() as unknown
    if (!Array.isArray(rawContents) || rawContents.length === 0) {
      console.warn('generateCFIFromXPath: 无法获取 contents')
      return null
    }

    // 获取第一个 content（当前页面）
    const content = rawContents[0] as { section?: any }
    const section = content.section
    if (!section || typeof section.cfiFromElement !== 'function') {
      console.warn('generateCFIFromXPath: section 不可用或缺少 cfiFromElement 方法')
      return null
    }

    // 3. 使用 section.cfiFromElement() 生成完整 CFI
    const cfi = section.cfiFromElement(element)

    if (!cfi || !cfi.startsWith('epubcfi(')) {
      console.warn('generateCFIFromXPath: 生成的 CFI 格式无效', cfi)
      return null
    }

    console.log('✅ 从 XPath 生成 CFI 成功:', { xpath, cfi: cfi.substring(0, 50) + '...' })
    return cfi

  } catch (error) {
    console.error('❌ generateCFIFromXPath 失败:', error)
    return null
  }
}

/**
 * 检查 CFI 是否有效（不是主进程生成的不完整格式）
 */
function isValidCFI(cfi: string | null | undefined): boolean {
  if (!cfi || !cfi.startsWith('epubcfi(')) return false
  // 主进程生成的无效 CFI 格式：epubcfi(/!/...)
  // 有效的 CFI 应该是：epubcfi(/6/4[...]!/...)
  if (cfi.includes('epubcfi(/!/')) return false
  return true
}

/**
 * 悬停高亮: 使用 epub.js 注解 API
 * 仅在存在有效或可恢复的 CFI 时触发，避免无 CFI 时误操作
 */
export function applyHoverHighlight(
  rendition: Rendition | null,
  cfiRange: string | null | undefined,
  xpath?: string
): string | null {
  if (!rendition) {
    console.warn('applyHoverHighlight: rendition 为 null')
    return null
  }

  // 检查 CFI 是否有效
  let actualCFI: string | null = null

  if (isValidCFI(cfiRange)) {
    actualCFI = cfiRange!
  } else if (cfiRange && xpath) {
    // CFI 无效或不存在，从 XPath 生成
    if (cfiRange) {
      console.log('⚠️ 数据库中的 CFI 无效，从 XPath 重新生成:', cfiRange)
    }
    actualCFI = generateCFIFromXPath(xpath, rendition)
  } else if (!cfiRange) {
    console.debug('applyHoverHighlight: 缺少 CFI，跳过阅读区域高亮')
    return null
  }

  if (!actualCFI) {
    console.warn('applyHoverHighlight: 无法获取有效的 CFI', { cfiRange, xpath })
    return null
  }

  const annotations = getAnnotations(rendition)
  if (!annotations) return null

  try {
    // 先移除可能存在的旧高亮
    annotations.remove(actualCFI, 'highlight')

    // 添加新高亮，传递明确的样式
    const mark = annotations.highlight(actualCFI, {}, (e: any) => {
      console.log('高亮被点击:', e)
    }, 'epubjs-hl', {
      'fill': 'yellow',
      'fill-opacity': '0.3'
    })

    console.log('✅ 悬停高亮已应用:', actualCFI, '返回值:', mark)
    return actualCFI
  } catch (error) {
    console.error('❌ 悬停高亮失败:', actualCFI, error)
    return null
  }
}

/**
 * 移除高亮
 */
export function removeHighlight(
  rendition: Rendition | null,
  cfiRange: string | null | undefined
): void {
  if (!rendition || !cfiRange) return

  const annotations = getAnnotations(rendition)
  if (!annotations) return

  try {
    annotations.remove(cfiRange, 'highlight')
    console.log('✅ 高亮已移除:', cfiRange)
  } catch (error) {
    console.warn('removeHighlight: 移除失败', cfiRange, error)
  }
}

/**
 * 闪烁高亮: 添加高亮后自动在持续时间后移除
 * 返回清理函数,可在高亮完成前手动取消
 * 优先使用 cfiRange，如果无效则从 xpath 动态生成
 */
export function flashHighlight(
  rendition: Rendition | null,
  cfiRange: string | null | undefined,
  duration = FLASH_HIGHLIGHT_DURATION,
  xpath?: string
): () => void {
  if (!rendition) {
    console.warn('flashHighlight: rendition 为 null')
    return () => {}
  }

  // 检查 CFI 是否有效
  let actualCFI: string | null = null

  if (isValidCFI(cfiRange)) {
    actualCFI = cfiRange!
  } else if (cfiRange && xpath) {
    // CFI 无效或不存在，从 XPath 生成
    if (cfiRange) {
      console.log('⚠️ 数据库中的 CFI 无效，从 XPath 重新生成 (闪烁):', cfiRange)
    }
    actualCFI = generateCFIFromXPath(xpath, rendition)
  } else if (!cfiRange) {
    console.debug('flashHighlight: 缺少 CFI，跳过闪烁高亮')
    return () => {}
  }

  if (!actualCFI) {
    console.warn('flashHighlight: 无法获取有效的 CFI', { cfiRange, xpath })
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
    removeHighlight(rendition, actualCFI)
  }

  try {
    // 先移除可能存在的旧高亮
    annotations.remove(actualCFI, 'highlight')

    // 添加闪烁高亮,使用主题样式
    annotations.highlight(actualCFI, {}, undefined)

    // 设置自动移除
    timeoutId = setTimeout(() => {
      cleanup()
    }, duration)

    console.log('✅ 闪烁高亮已应用,将在', duration, 'ms 后移除')
  } catch (error) {
    console.error('❌ 闪烁高亮失败:', actualCFI, error)
  }

  return cleanup
}

/**
 * 通过 XPath 在 Document 中查找元素
 * 仅用于读取段落文本,不用于定位和高亮
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
 * 在 epub.js 的 rendition 中通过 XPath 查找元素
 * 仅用于读取段落文本,不用于定位和高亮
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
        return element
      }
    }

    return null
  } catch (error) {
    console.error('findElementInRendition: 查找失败', error)
    return null
  }
}
