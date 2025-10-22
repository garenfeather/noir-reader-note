/**
 * 项目列表组件
 * 显示所有已创建的项目
 */

import { Empty, List, Button, message } from 'antd'
import { useEffect, useState } from 'react'
import { FolderOutlined, DeleteOutlined } from '@ant-design/icons'

export interface ProjectListItem {
  id: string
  epubName: string
  epubPath: string
  projectPath: string
  createdAt?: string
  updatedAt?: string
  metadata?: any
  displayTitle?: string
}

interface Props {
  onSelectProject: (project: ProjectListItem) => void
}

function ProjectList({ onSelectProject }: Props) {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)

  const formatUpdatedAt = (updatedAt?: string | null) => {
    if (!updatedAt) {
      return '最后修改时间未知'
    }

    const date = new Date(updatedAt)
    if (Number.isNaN(date.getTime())) {
      return '最后修改时间未知'
    }

    return date.toLocaleString()
  }

  // 加载项目列表（从文件系统读取）
  const loadProjects = async () => {
    try {
      setLoading(true)

      // 检查 API 是否可用
      if (!window.electronAPI?.getProjectsFromDisk) {
        console.warn('getProjectsFromDisk API 未定义')
        setProjects([])
        setLoading(false)
        return
      }

      const result = await window.electronAPI.getProjectsFromDisk()
      if (result.success && result.data) {
        setProjects(result.data)
      } else {
        console.error('加载项目列表失败:', result.error)
        setProjects([])
      }
    } catch (error) {
      console.error('加载项目列表失败:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  // 删除项目
  const handleDelete = async (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation() // 阻止冒泡，避免触发选择

    const confirmed = confirm('确定要删除该项目吗？此操作不可恢复！')
    if (!confirmed) return

    try {
      const result = await window.electronAPI.deleteProject(projectId)
      if (result.success) {
        message.success('项目已删除')
        // 重新加载列表
        loadProjects()
      } else {
        message.error('删除项目失败: ' + result.error)
      }
    } catch (error) {
      console.error('删除项目失败:', error)
      message.error('删除项目失败')
    }
  }

  // 获取显示标题（优先使用后端返回的displayTitle）
  const getDisplayTitle = (project: ProjectListItem) => {
    return project.displayTitle || project.id
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div>加载中...</div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="p-4">
        <Empty description="暂无项目，请打开EPUB文件创建项目" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold">项目列表</h3>
      </div>

      <div className="flex-1 overflow-auto">
        <List
          dataSource={projects}
          renderItem={(project) => (
            <List.Item
              key={project.id}
              className="cursor-pointer hover:bg-gray-50 transition-colors px-4"
              onClick={() => onSelectProject(project)}
              extra={
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => handleDelete(project.id, e)}
                />
              }
            >
              <List.Item.Meta
                avatar={<FolderOutlined className="text-blue-500 text-xl" />}
                title={<div className="truncate">{getDisplayTitle(project)}</div>}
                description={
                  <div className="text-xs text-gray-500 truncate">
                    最后修改：{formatUpdatedAt(project.updatedAt)}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  )
}

export default ProjectList
