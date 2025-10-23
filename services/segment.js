/**
 * 分段解析服务
 * 从EPUB的xhtml文件中提取段落并生成分段数据
 */

const { JSDOM } = require('jsdom')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const EpubCFI = require('epubjs/lib/epubcfi')

// 使用 Node.js crypto 生成 UUID
function uuidv4() {
  return crypto.randomUUID()
}

// 被识别为段落的HTML标签
const PARAGRAPH_TAGS = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']

class SegmentService {
  /**
   * 生成一行预览文字
   * @param {string} text - 原文本
   * @param {number} maxLength - 最大字符数（根据UI显示效果调整）
   */
  generatePreview(text, maxLength = 50) {
    if (!text) return ''
    const trimmed = text.trim()
    return trimmed.length > maxLength
      ? trimmed.substring(0, maxLength) + '...'
      : trimmed
  }

  /**
   * 解析xhtml文件，提取段落
   * @param {string} xhtmlPath - xhtml文件路径
   * @param {string} chapterId - 章节ID
   * @param {string} chapterHref - 章节href
   * @param {string} projectId - 项目ID
   */
  parseXhtml(xhtmlPath, chapterId, chapterHref, projectId) {
    try {
      console.log('开始解析xhtml:', xhtmlPath)

      // 读取文件
      if (!fs.existsSync(xhtmlPath)) {
        throw new Error(`文件不存在: ${xhtmlPath}`)
      }

      const html = fs.readFileSync(xhtmlPath, 'utf-8')

      // 使用jsdom解析（使用text/html而不是application/xhtml+xml以避免严格的XML实体检查）
      const dom = new JSDOM(html, {
        contentType: 'text/html'
      })

      const document = dom.window.document
      const body = document.body || document.documentElement

      // 提取段落
      const paragraphs = this.extractParagraphs(body)

      // 生成分段数据，包含preview和textLength
      const segments = paragraphs.map((para, index) => {
        const segment = {
          id: uuidv4(),
          projectId: projectId,
          chapterId: chapterId,
          chapterHref: chapterHref,
          xpath: para.xpath,
          cfiRange: null,  // CFI将在渲染进程中生成
          position: index,
          isEmpty: para.isEmpty,
          parentSegmentId: null,
          preview: this.generatePreview(para.text),  // 预览文字
          textLength: para.text.length  // 完整文本的字符数
        }

        return segment
      })

      console.log(`解析完成，找到 ${segments.length} 个段落 (${paragraphs.filter(p => !p.isEmpty).length} 个非空)`)

      return {
        segments: segments,
        chapterId: chapterId,
        chapterHref: chapterHref,
        totalCount: segments.length,
        emptyCount: paragraphs.filter(p => p.isEmpty).length
      }
    } catch (error) {
      console.error('解析xhtml失败:', error)
      throw error
    }
  }

  /**
   * 从DOM中提取段落元素
   */
  extractParagraphs(rootElement) {
    const paragraphs = []
    const walker = rootElement.ownerDocument.createTreeWalker(
      rootElement,
      rootElement.ownerDocument.defaultView.NodeFilter.SHOW_ELEMENT,
      null
    )

    let currentNode
    let index = 0

    while ((currentNode = walker.nextNode())) {
      const tagName = currentNode.tagName.toLowerCase()

      // 检查是否是段落标签
      if (PARAGRAPH_TAGS.includes(tagName)) {
        // 排除嵌套的段落（只取最外层）
        const hasParentParagraph = this.hasAncestorInTags(currentNode, PARAGRAPH_TAGS)
        if (hasParentParagraph) {
          continue
        }

        const text = this.getTextContent(currentNode)
        const isEmpty = text.trim().length === 0
        const xpath = this.getXPath(currentNode)

        paragraphs.push({
          element: currentNode,
          xpath: xpath,
          text: text,
          isEmpty: isEmpty,
          index: index++
        })
      }
    }

    return paragraphs
  }

  /**
   * 检查元素是否有特定标签的祖先
   */
  hasAncestorInTags(element, tags) {
    let parent = element.parentElement
    while (parent) {
      if (tags.includes(parent.tagName.toLowerCase())) {
        return true
      }
      parent = parent.parentElement
    }
    return false
  }

  /**
   * 获取元素的文本内容
   */
  getTextContent(element) {
    return element.textContent || ''
  }

  /**
   * 生成元素的XPath
   */
  getXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`
    }

    const parts = []
    let current = element

    while (current && current.nodeType === current.ELEMENT_NODE) {
      let index = 0
      let sibling = current.previousElementSibling

      // 计算同名兄弟节点中的位置
      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++
        }
        sibling = sibling.previousElementSibling
      }

      const tagName = current.tagName.toLowerCase()
      const part = index > 0 ? `${tagName}[${index + 1}]` : tagName

      parts.unshift(part)

      current = current.parentElement
    }

    return '/' + parts.join('/')
  }

  /**
   * 根据XPath在document中查找元素
   */
  getElementByXPath(document, xpath) {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        document.defaultView.XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      )

      return result.singleNodeValue
    } catch (error) {
      console.error('XPath查找失败:', xpath, error)
      return null
    }
  }

  /**
   * 通过XPath从xhtml文件获取文本
   * @param {string} xhtmlPath - xhtml文件路径
   * @param {string} xpath - 目标元素的XPath
   * @returns {string} 元素的文本内容
   */
  getSegmentTextByXPath(xhtmlPath, xpath) {
    try {
      if (!xpath) {
        throw new Error('缺少XPath参数')
      }

      if (!fs.existsSync(xhtmlPath)) {
        throw new Error(`文件不存在: ${xhtmlPath}`)
      }

      const html = fs.readFileSync(xhtmlPath, 'utf-8')
      const dom = new JSDOM(html, {
        contentType: 'text/html'
      })

      const document = dom.window.document

      let element = null

      // 优先处理根据ID生成的XPath（性能更好）
      const idMatch = xpath.match(/^\/\/\*\[@id="(.+)"\]$/)
      if (idMatch) {
        element = document.getElementById(idMatch[1])
      }

      if (!element) {
        element = this.getElementByXPath(document, xpath)
      }

      if (!element) {
        console.warn('SegmentService: XPath未匹配到元素', { xpath, xhtmlPath })
        return ''
      }

      const text = this.getTextContent(element).trim()

      return text
    } catch (error) {
      console.error('SegmentService: 通过XPath获取文本失败', error)
      throw error
    }
  }

  /**
   * 拆分段落（手动分割）
   * 注意：分段文本不存储，分割时保持相同的xpath，文本在显示时从XHTML动态读取
   * 只更新分段的metadata（position, parentSegmentId）
   *
   * @param {Object} parentSegment - 父分段
   * @param {number} splitCount - 要分成的段数（预留参数，目前简单地复制parent segment）
   */
  splitSegment(parentSegment, splitCount = 2) {
    const parts = []

    for (let i = 0; i < splitCount; i++) {
      parts.push({
        ...parentSegment,
        id: uuidv4(),
        parentSegmentId: parentSegment.id,
        position: parentSegment.position + (i * 0.01)
      })
    }

    return parts
  }

  /**
   * 为 DOM 元素生成 CFI Range
   * @param {Element} element - 段落元素
   * @param {Document} document - jsdom 的 document 对象
   * @returns {string|null} CFI Range 字符串或 null（失败时）
   */
  generateCFI(element, document) {
    try {
      if (!element || !document) {
        console.warn('generateCFI: 缺少必要参数')
        return null
      }

      // 创建 Range 对象
      const range = document.createRange()

      // 选择元素的所有内容
      range.selectNodeContents(element)

      // 使用 epubjs 自带的 EpubCFI 生成 CFI
      const cfi = new EpubCFI()
      const cfiRange = cfi.generateCfiFromRange(range, document)

      return cfiRange || null
    } catch (error) {
      console.warn('generateCFI: 生成 CFI 失败', {
        tagName: element?.tagName,
        error: error.message
      })
      return null
    }
  }
}

// 单例模式
const segmentService = new SegmentService()

module.exports = segmentService
