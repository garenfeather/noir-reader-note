import { create } from 'zustand'
import { Book, Rendition } from 'epubjs'
import { message } from 'antd'

interface BookState {
  book: Book | null
  rendition: Rendition | null
  currentLocation: number  // 当前位置（整本书）
  totalLocations: number   // 总位置数（整本书）
  percentage: number       // 阅读百分比
  fileName: string
  metadataTitle: string
  setBook: (book: Book | null) => void
  setRendition: (rendition: Rendition | null) => void
  setCurrentLocation: (current: number) => void
  setTotalLocations: (total: number) => void
  setPercentage: (percentage: number) => void
  setFileName: (fileName: string) => void
  setMetadataTitle: (title: string) => void
  jumpToCfi: (cfi: string) => Promise<void>
  getChapterLabel: (href: string) => string
}

export const useBookStore = create<BookState>((set, get) => ({
  book: null,
  rendition: null,
  currentLocation: 0,
  totalLocations: 0,
  percentage: 0,
  fileName: '',
  metadataTitle: '',
  setBook: (book) => set({ book }),
  setRendition: (rendition) => set({ rendition }),
  setCurrentLocation: (current) => set({ currentLocation: current }),
  setTotalLocations: (total) => set({ totalLocations: total }),
  setPercentage: (percentage) => set({ percentage }),
  setFileName: (fileName) => set({ fileName }),
  setMetadataTitle: (metadataTitle) => set({ metadataTitle }),

  /**
   * 跳转到指定CFI位置（支持跨章跳转）
   * @param cfi - CFI Range字符串
   */
  jumpToCfi: async (cfi: string) => {
    const { rendition } = get()
    if (!rendition) {
      message.error('阅读器未初始化')
      return
    }

    try {
      // 1. 跳转到指定CFI（支持跨章）
      await rendition.display(cfi)

      // 2. 等待渲染完成
      await new Promise(resolve => setTimeout(resolve, 300))

      // 3. 高亮目标文本
      try {
        rendition.annotations.highlight(cfi, {}, () => {
          console.log('CFI 高亮成功:', cfi)
        }, 'highlight-jump', {
          fill: 'yellow',
          'fill-opacity': '0.3',
          'mix-blend-mode': 'multiply'
        })
      } catch (highlightError) {
        console.warn('高亮失败:', highlightError)
        // 高亮失败不影响跳转
      }

      // 4. 滚动到目标位置（尝试将其滚动到屏幕中央）
      try {
        const range = rendition.getRange(cfi)
        if (range) {
          const element = range.startContainer.parentElement
          if (element) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            })
          }
        }
      } catch (scrollError) {
        console.warn('滚动失败:', scrollError)
        // 滚动失败不影响跳转
      }

      // 定位成功，不显示提示
    } catch (error) {
      console.error('跳转到CFI失败:', error)
      message.error('定位失败')
    }
  },

  /**
   * 根据章节 href 获取章节名称
   * 从 book.navigation.toc 中查找匹配的章节
   * @param href - 章节文件路径（如 "Text/c1_1t.xhtml"）
   * @returns 章节名称，未找到则返回 href
   */
  getChapterLabel: (href: string) => {
    const { book } = get()
    if (!book || !book.navigation) {
      return href
    }

    // 递归查找 TOC 中匹配的项
    const findInToc = (items: any[], targetHref: string): string | null => {
      for (const item of items) {
        // 处理 href，去掉可能的锚点和查询参数
        const itemHref = item.href?.split('#')[0]?.split('?')[0]
        const normalizedTarget = targetHref.split('#')[0]?.split('?')[0]

        // 匹配 href（支持部分匹配）
        if (itemHref && (itemHref === normalizedTarget || itemHref.endsWith(normalizedTarget) || normalizedTarget.endsWith(itemHref))) {
          return item.label || item.title || null
        }

        // 递归查找子项
        if (item.subitems && item.subitems.length > 0) {
          const found = findInToc(item.subitems, targetHref)
          if (found) return found
        }
      }
      return null
    }

    const label = findInToc(book.navigation.toc || [], href)
    return label || href
  }
}))
