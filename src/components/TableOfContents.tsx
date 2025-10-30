import { Empty, Menu, Slider } from 'antd'
import { useEffect, useState, useCallback, useRef } from 'react'
import ePub, { NavItem } from 'epubjs'
import { useBookStore } from '../store/bookStore'
import type { MenuProps } from 'antd'
import { useSegmentStore } from '../store/segmentStore'

interface Props {
  epubData: ArrayBuffer | null
  currentChapterHref?: string
}

type MenuItem = Required<MenuProps>['items'][number]

const normalizeHref = (href: string) => {
  if (!href) return ''
  const withoutHash = href.split('#')[0] || href
  return withoutHash.split('?')[0] || withoutHash
}

function TableOfContents({ epubData, currentChapterHref = '' }: Props) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [rawNavItems, setRawNavItems] = useState<NavItem[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const { book, rendition, currentLocation, totalLocations, percentage } = useBookStore()
  const chaptersWithSegments = useSegmentStore(state => state.chaptersWithSegments)
  const keyToHrefRef = useRef<Map<string, string>>(new Map())
  const hrefToKeyRef = useRef<Map<string, string>>(new Map())
  const parentKeyRef = useRef<Map<string, string | null>>(new Map())
  const menuContainerRef = useRef<HTMLDivElement>(null)

  // 递归构建菜单项和映射
  const buildMenuItemsAndMap = useCallback((items: NavItem[], segmentsSet: Set<string>) => {
    const keyHrefMap = new Map<string, string>()
    const hrefKeyMap = new Map<string, string>()
    const parentKeyMap = new Map<string, string | null>()
    const normalizedSegmentSet = new Set<string>(Array.from(segmentsSet).map(normalizeHref))

    const buildItems = (navItems: NavItem[], keyPrefix = '', parentKey: string | null = null): MenuItem[] => {
      return navItems.map((item, index) => {
        const key = keyPrefix ? `${keyPrefix}-${index}` : index.toString()
        parentKeyMap.set(key, parentKey)

        // 保存 href 映射
        if (item.href) {
          keyHrefMap.set(key, item.href)
          hrefKeyMap.set(normalizeHref(item.href), key)
        }

        const hasSegments = item.href ? normalizedSegmentSet.has(normalizeHref(item.href)) : false

        const menuItem: MenuItem = {
          key,
          label: (
            <span className="relative truncate flex items-center justify-between w-full pr-2">
              <span className="truncate">{item.label}</span>
              {hasSegments && (
                <span className="flex-shrink-0 inline-block w-1.5 h-1.5 bg-blue-500 transform rotate-45 rounded-[1px]" />
              )}
            </span>
          ),
        }

        // 如果有子项，递归构建
        if (item.subitems && item.subitems.length > 0) {
          menuItem.children = buildItems(item.subitems, key, key)
        }

        return menuItem
      })
    }

    const resultItems = buildItems(items)
    return { items: resultItems, keyHrefMap, hrefKeyMap, parentKeyMap }
  }, [])

  useEffect(() => {
    if (!epubData) {
      setMenuItems([])
      keyToHrefRef.current = new Map()
      hrefToKeyRef.current = new Map()
      parentKeyRef.current = new Map()
      setSelectedKeys([])
      setOpenKeys([])
      setRawNavItems([])
      return
    }

    const book = ePub(epubData)
    book.ready.then(() => {
      book.loaded.navigation.then((navigation) => {
        console.log('目录结构:', navigation.toc)

        setRawNavItems(navigation.toc)
        console.log('构建的映射:', navigation.toc.length)
      })
    })
  }, [epubData])

  useEffect(() => {
    if (rawNavItems.length === 0) {
      setMenuItems([])
      keyToHrefRef.current = new Map()
      hrefToKeyRef.current = new Map()
      parentKeyRef.current = new Map()
      setSelectedKeys([])
      setOpenKeys([])
      return
    }

    const { items, keyHrefMap, hrefKeyMap, parentKeyMap } = buildMenuItemsAndMap(rawNavItems, chaptersWithSegments)
    setMenuItems(items)
    keyToHrefRef.current = keyHrefMap
    hrefToKeyRef.current = hrefKeyMap
    parentKeyRef.current = parentKeyMap
  }, [rawNavItems, chaptersWithSegments, buildMenuItemsAndMap])

  const scrollMenuItemIntoView = useCallback((key: string) => {
    const container = menuContainerRef.current
    if (!container) return
    const menuItemNode = container.querySelector<HTMLElement>(`[data-menu-id="${key}"]`)
    if (menuItemNode) {
      menuItemNode.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [])

  const ensureParentsOpen = useCallback((key: string) => {
    const parents: string[] = []
    let current = parentKeyRef.current.get(key) ?? null
    while (current) {
      parents.push(current)
      current = parentKeyRef.current.get(current) ?? null
    }
    if (parents.length > 0) {
      setOpenKeys(prev => {
        const merged = new Set(prev)
        parents.forEach(p => merged.add(p))
        return Array.from(merged)
      })
    }
    requestAnimationFrame(() => scrollMenuItemIntoView(key))
  }, [scrollMenuItemIntoView])

  const updateSelectionByHref = useCallback((href: string) => {
    if (!href) {
      setSelectedKeys([])
      return
    }
    const key = hrefToKeyRef.current.get(normalizeHref(href))
    if (!key) return
    setSelectedKeys(prev => (prev.length === 1 && prev[0] === key ? prev : [key]))
    ensureParentsOpen(key)
  }, [ensureParentsOpen])

  useEffect(() => {
    if (!currentChapterHref) {
      setSelectedKeys([])
      return
    }
    if (hrefToKeyRef.current.size === 0) return
    updateSelectionByHref(currentChapterHref)
  }, [currentChapterHref, updateSelectionByHref, menuItems])

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (!rendition) return

    const keyStr = String(key)
    const href = keyToHrefRef.current.get(keyStr)
    console.log('点击目录项:', { key: keyStr, href, mapSize: keyToHrefRef.current.size })

    if (href) {
      console.log('跳转到:', keyStr, href)
      setSelectedKeys([keyStr])
      ensureParentsOpen(keyStr)
      rendition.display(href)
    } else {
      console.warn('未找到对应的 href:', keyStr)
    }
  }

  const handleOpenChange: MenuProps['onOpenChange'] = (keys) => {
    setOpenKeys(keys as string[])
  }

  const handleSliderChange = (value: number) => {
    if (!book || !rendition || !book.locations || book.locations.length() === 0) return

    // 根据百分比计算 cfi 位置并跳转
    const targetPercentage = value / 100
    const target = book.locations.cfiFromPercentage(targetPercentage)
    rendition.display(target)
  }

  if (!epubData) {
    return (
      <div className="p-4">
        <Empty description="请打开 EPUB 文件" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold">目录</h3>
      </div>
      <div ref={menuContainerRef} className="flex-1 overflow-auto scrollbar-hide">
        <Menu
          mode="inline"
          items={menuItems}
          className="border-none"
          onClick={handleMenuClick}
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
        />
      </div>

      {/* 阅读进度 */}
      <div className="border-t border-gray-200 px-4 py-3 bg-white">
        <div className="text-center text-gray-400 text-sm mb-2">
          {currentLocation}/{totalLocations}
        </div>
        <Slider
          min={0}
          max={100}
          value={percentage * 100}
          onChange={handleSliderChange}
          tooltip={{ formatter: (value) => `${Math.round(value || 0)}%` }}
        />
      </div>
    </div>
  )
}

export default TableOfContents
