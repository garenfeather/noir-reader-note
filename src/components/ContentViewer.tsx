import { useEffect, useRef } from 'react'
import { Empty } from 'antd'
import ePub, { Book, Rendition } from 'epubjs'
import { useBookStore } from '../store/bookStore'

interface Props {
  epubData: ArrayBuffer | null
}

function ContentViewer({ epubData }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const isRenditionReadyRef = useRef<boolean>(false)

  const { setBook, setRendition, setCurrentLocation, setTotalLocations, setPercentage, setMetadataTitle } = useBookStore()

  useEffect(() => {
    if (!epubData || !viewerRef.current) {
      console.log('ContentViewer: 缺少数据或容器', { epubData: !!epubData, viewerRef: !!viewerRef.current })
      return
    }

    console.log('ContentViewer: 开始加载 EPUB')

    // 清理之前的实例
    if (renditionRef.current) {
      console.log('ContentViewer: 清理之前的实例')
      renditionRef.current.destroy()
    }

    try {
      const book = ePub(epubData)
      bookRef.current = book
      setBook(book)
      console.log('ContentViewer: Book 实例创建成功')

      const rendition = book.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none',
      })

      renditionRef.current = rendition
      setRendition(rendition)
      console.log('ContentViewer: Rendition 创建成功')

      // 生成位置信息（用于整本书的进度跟踪）
      book.ready.then(() => {
        return book.locations.generate(1024)
      }).then((locations) => {
        console.log('ContentViewer: Locations 生成完成，总数:', locations.length)
        setTotalLocations(locations.length)
      })

      book.loaded.metadata.then((metadata) => {
        const title = metadata?.title?.trim() || ''
        setMetadataTitle(title)
        console.log('ContentViewer: Metadata 加载完成', { title })
      }).catch((err) => {
        console.error('ContentViewer: 加载 metadata 失败', err)
        setMetadataTitle('')
      })

      rendition.display().then(() => {
        console.log('ContentViewer: 内容显示成功')
        isRenditionReadyRef.current = true
      }).catch((err) => {
        console.error('ContentViewer: 显示内容失败', err)
      })

      // 更新整本书的阅读进度
      rendition.on('relocated', (location) => {
        if (book.locations && book.locations.length() > 0) {
          const currentCfi = location.start.cfi
          const currentIndex = book.locations.locationFromCfi(currentCfi)
          const totalLocs = book.locations.length()
          const percent = book.locations.percentageFromCfi(currentCfi)

          setCurrentLocation(currentIndex)
          setTotalLocations(totalLocs)
          setPercentage(percent)

          console.log('进度更新:', {
            currentIndex,
            totalLocs,
            percent: (percent * 100).toFixed(1) + '%'
          })
        }
      })

      // 监听容器大小变化，重新调整 epub 渲染
      let resizeTimeout: NodeJS.Timeout
      const resizeObserver = new ResizeObserver(() => {
        // 添加防抖，避免频繁调用
        clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(() => {
          // 只在 rendition 准备好后才调用 resize
          if (isRenditionReadyRef.current && renditionRef.current && typeof renditionRef.current.resize === 'function') {
            console.log('ContentViewer: 容器大小变化，重新调整渲染')
            try {
              renditionRef.current.resize()
            } catch (err) {
              console.error('ContentViewer: resize 调用失败', err)
            }
          }
        }, 100)
      })

      if (viewerRef.current) {
        resizeObserver.observe(viewerRef.current)
      }

      return () => {
        clearTimeout(resizeTimeout)
        resizeObserver.disconnect()
        isRenditionReadyRef.current = false
        rendition.destroy()
        setBook(null)
        setRendition(null)
      }
    } catch (error) {
      console.error('ContentViewer: 加载 EPUB 出错', error)
    }
  }, [epubData, setBook, setRendition, setCurrentLocation, setTotalLocations, setPercentage, setMetadataTitle])

  if (!epubData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Empty description="请打开 EPUB 文件开始阅读" />
      </div>
    )
  }

  // 处理点击翻页
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !renditionRef.current) return

    // 获取点击位置相对于容器的位置
    const rect = containerRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const halfWidth = rect.width / 2

    console.log('点击翻页:', { clickX, halfWidth, direction: clickX < halfWidth ? '上一页' : '下一页' })

    // 左半部分上一页，右半部分下一页
    if (clickX < halfWidth) {
      renditionRef.current.prev()
    } else {
      renditionRef.current.next()
    }
  }

  return (
    <div
      ref={containerRef}
      className="h-full relative"
      onClick={handleClick}
    >
      {/* 左半部分点击区域 */}
      <div className="absolute left-0 top-0 w-1/2 h-full cursor-w-resize z-10" />
      {/* 右半部分点击区域 */}
      <div className="absolute right-0 top-0 w-1/2 h-full cursor-e-resize z-10" />
      {/* 阅读区域 */}
      <div
        ref={viewerRef}
        className="h-full relative z-0"
      />
    </div>
  )
}

export default ContentViewer
