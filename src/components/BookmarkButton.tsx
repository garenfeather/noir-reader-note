/**
 * 书签收藏按钮组件
 * 只在只读模式下显示，支持切换收藏/取消收藏
 */

import { Button } from 'antd'
import { StarOutlined, StarFilled } from '@ant-design/icons'
import { useBookmarkStore } from '../store/bookmarkStore'

interface Props {
  segmentId: string
  isReadOnly: boolean  // 只在只读模式下显示
}

function BookmarkButton({ segmentId, isReadOnly }: Props) {
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarkStore()
  const bookmarked = isBookmarked(segmentId)

  // 如果不是只读模式，不显示按钮
  if (!isReadOnly) {
    return null
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // 阻止事件冒泡
    if (bookmarked) {
      // 已收藏，点击取消收藏
      await removeBookmark(segmentId)
    } else {
      // 未收藏，点击收藏
      await addBookmark(segmentId)
    }
  }

  return (
    <Button
      size="small"
      type="text"
      icon={bookmarked ? <StarFilled /> : <StarOutlined />}
      onClick={handleClick}
      className={bookmarked ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}
      title={bookmarked ? '取消收藏' : '收藏'}
    />
  )
}

export default BookmarkButton
