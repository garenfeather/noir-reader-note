/**
 * 分段列表组件
 * 显示所有分段卡片
 */

import { List, Spin, Empty, Button, Space } from 'antd'
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons'
import { useSegmentStore } from '../store/segmentStore'
import SegmentCard from './SegmentCard'
import SegmentDetail from './SegmentDetail'

interface Props {
  onAccept: () => void
  onDiscard: () => void
  allowEditing: boolean
  mode: 'read' | 'translate'
}

function SegmentList({ onAccept, onDiscard, allowEditing, mode }: Props) {
  const {
    visibleSegments,
    hoveredSegmentId,
    selectedSegmentId,
    isLoading,
    isParsed,
    isEditMode,
    setHoveredSegment,
    setSelectedSegment,
    setEditMode
  } = useSegmentStore()

  // 处理接受
  const handleAccept = () => {
    if (!allowEditing) return
    onAccept()
    setEditMode(false) // 退出编辑模式
  }

  // 处理丢弃
  const handleDiscard = () => {
    if (!allowEditing) return
    onDiscard()
    setEditMode(false) // 退出编辑模式
  }

  // 处理编辑
  const handleEdit = () => {
    if (!allowEditing) return
    setEditMode(true) // 进入编辑模式
  }

  // 获取选中的段落
  const selectedSegment = visibleSegments.find(s => s.id === selectedSegmentId)
  const selectedIndex = selectedSegment
    ? visibleSegments.findIndex(s => s.id === selectedSegmentId)
    : -1

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin tip="正在分析段落..." />
      </div>
    )
  }

  if (!isParsed || visibleSegments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Empty description={mode === 'translate' ? '点击「分割」按钮开始分段' : '当前章节暂无附注'} />
      </div>
    )
  }

  // 如果选中了段落,显示详情页面
  if (selectedSegment && selectedIndex >= 0) {
    return (
      <SegmentDetail
        segment={selectedSegment}
        index={selectedIndex}
        onBack={() => setSelectedSegment(null)}
      />
    )
  }

  // 显示段落列表
  return (
    <div className="h-full flex flex-col">
      {/* 分段列表 */}
      <div className="flex-1 overflow-auto px-4 py-2">
        <List
          dataSource={visibleSegments}
          renderItem={(segment, index) => (
            <List.Item key={segment.id} className="!border-none !p-0">
              <SegmentCard
                segment={segment}
                index={index}
                isHovered={hoveredSegmentId === segment.id}
                onMouseEnter={() => setHoveredSegment(segment.id)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => setSelectedSegment(segment.id)}
              />
            </List.Item>
          )}
        />
      </div>

      {/* 底部操作按钮 */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="mb-2 text-xs text-gray-500 text-center">
          共 {visibleSegments.length} 个段落
        </div>
        {allowEditing && (
          isEditMode ? (
            // 编辑模式：显示接受/丢弃按钮
            <Space className="w-full justify-center" direction="horizontal" size="middle">
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleAccept}
              >
                接受
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={handleDiscard}
              >
                丢弃
              </Button>
            </Space>
          ) : (
            // 非编辑模式：显示编辑按钮
            <div className="w-full flex justify-center">
              <Button
                icon={<EditOutlined />}
                onClick={handleEdit}
              >
                编辑
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default SegmentList
