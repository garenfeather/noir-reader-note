import { Empty, Menu, Slider } from 'antd'
import { useEffect, useState, useCallback } from 'react'
import ePub, { NavItem } from 'epubjs'
import { useBookStore } from '../store/bookStore'
import type { MenuProps } from 'antd'
import { useSegmentStore } from '../store/segmentStore'

interface Props {
  epubData: ArrayBuffer | null
}

type MenuItem = Required<MenuProps>['items'][number]

function TableOfContents({ epubData }: Props) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [tocMap, setTocMap] = useState<Map<string, string>>(new Map())
  const [rawNavItems, setRawNavItems] = useState<NavItem[]>([])
  const { book, rendition, currentLocation, totalLocations, percentage } = useBookStore()
  const chaptersWithSegments = useSegmentStore(state => state.chaptersWithSegments)

  // 递归构建菜单项和映射
  const buildMenuItemsAndMap = useCallback((items: NavItem[], segmentsSet: Set<string>, prefix = ''): { items: MenuItem[], map: Map<string, string> } => {
    const map = new Map<string, string>()

    const buildItems = (navItems: NavItem[], keyPrefix = ''): MenuItem[] => {
      return navItems.map((item, index) => {
        const key = keyPrefix ? `${keyPrefix}-${index}` : index.toString()

        // 保存 href 映射
        if (item.href) {
          map.set(key, item.href)
        }

        const hasSegments = item.href ? segmentsSet.has(item.href) : false

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
          menuItem.children = buildItems(item.subitems, key)
        }

        return menuItem
      })
    }

    const resultItems = buildItems(items, prefix)
    return { items: resultItems, map }
  }, [])

  useEffect(() => {
    if (!epubData) {
      setMenuItems([])
      setTocMap(new Map())
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
      setTocMap(new Map())
      return
    }

    const { items, map } = buildMenuItemsAndMap(rawNavItems, chaptersWithSegments)
    setMenuItems(items)
    setTocMap(map)
  }, [rawNavItems, chaptersWithSegments, buildMenuItemsAndMap])

  const handleMenuClick = ({ key }: { key: string }) => {
    if (!rendition) return

    const href = tocMap.get(key)
    console.log('点击目录项:', { key, href, mapSize: tocMap.size })

    if (href) {
      console.log('跳转到:', key, href)
      rendition.display(href)
    } else {
      console.warn('未找到对应的 href:', key)
    }
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
      <div className="flex-1 overflow-auto scrollbar-hide">
        <Menu
          mode="inline"
          items={menuItems}
          className="border-none"
          onClick={handleMenuClick}
          defaultOpenKeys={[]}
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
