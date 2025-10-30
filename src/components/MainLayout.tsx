import { useState, useEffect } from 'react'
import { Layout, Button, Space, message, Modal } from 'antd'
import { FileTextOutlined, CloseOutlined, SettingOutlined } from '@ant-design/icons'
import ProjectList, { ProjectListItem } from './ProjectList'
import TableOfContents from './TableOfContents'
import ContentViewer from './ContentViewer'
import TranslationPanel from './TranslationPanel'
import TranslationSettingsModal from './TranslationSettingsModal'
import { useBookStore } from '../store/bookStore'
import { useProjectStore } from '../store/projectStore'
import { useSegmentStore } from '../store/segmentStore'

const { Header, Content } = Layout

function MainLayout() {
  // 移除 mode 状态，右侧面板始终显示，编辑/只读通过 isEditMode 控制
  const [showTranslationPanel, setShowTranslationPanel] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [epubData, setEpubData] = useState<ArrayBuffer | null>(null)
  const [epubPath, setEpubPath] = useState<string>('')
  const [currentChapterId, setCurrentChapterId] = useState<string>('')
  const [currentChapterHref, setCurrentChapterHref] = useState<string>('')

  const {
    fileName,
    metadataTitle,
    book,
    rendition,
    setFileName,
    setMetadataTitle,
    setBook,
    setRendition,
    setCurrentLocation,
    setTotalLocations,
    setPercentage,
  } = useBookStore()

  const { currentProject, hasUnsavedChanges, setCurrentProject, clearProject, setHasUnsavedChanges } = useProjectStore()
  const {
    setSegments,
    clearSegments,
    setLoading,
    setParsed,
    setEditMode,
    setChaptersWithSegments,
    setActiveChapter
  } = useSegmentStore()

  // 打开EPUB文件
  const handleOpenFile = async () => {
    try {
      console.log('尝试打开文件...')
      if (!window.electronAPI) {
        console.error('electronAPI 未定义')
        alert('Electron API 未加载，请确保在 Electron 环境中运行')
        return
      }

      // 立即显示加载提示
      const loadingMsg = message.loading('正在打开文件...', 0)

      const result = await window.electronAPI.openFile()
      console.log('文件选择结果:', result)

      if (result) {
        const extractFileName = (fullPath: string) => {
          if (!fullPath) return ''
          const lastSlashIndex = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'))
          return lastSlashIndex >= 0 ? fullPath.slice(lastSlashIndex + 1) : fullPath
        }
        const name = extractFileName(result.path)
        setMetadataTitle('')
        setFileName(name)
        setEpubPath(result.path)

        // 将数组转换回 ArrayBuffer
        const uint8Array = new Uint8Array(result.data)
        const arrayBuffer = uint8Array.buffer
        console.log('设置 EPUB 数据, 大小:', arrayBuffer.byteLength)
        setEpubData(arrayBuffer)

        // 关闭加载提示
        loadingMsg()

        // 自动创建项目
        await createProject(result.path, arrayBuffer)
      } else {
        // 用户取消选择文件
        loadingMsg()
      }
    } catch (error) {
      console.error('打开文件出错:', error)
      message.error('打开文件失败: ' + error)
    }
  }

  // 为打开的EPUB创建项目
  const createProject = async (path?: string, data?: ArrayBuffer, forceCreate = false) => {
    // 使用传入参数或全局状态
    const epubPathToUse = path || epubPath
    const epubDataToUse = data || epubData

    if (!epubPathToUse || !epubDataToUse) {
      message.error('请先打开EPUB文件')
      return
    }

    try {
      message.loading('正在创建项目...', 0)

      // 获取EPUB元数据
      const metadata = book?.loaded?.metadata
        ? await book.loaded.metadata
        : null

      // 转换为数组格式
      const epubDataArray = Array.from(new Uint8Array(epubDataToUse))

      // 调用Main进程创建项目
      const result = await window.electronAPI.createProject(
        epubPathToUse,
        epubDataArray,
        metadata,
        forceCreate
      )

      message.destroy()

      if (result.success && result.data) {
        if (result.data.exists && !forceCreate) {
          // 项目已存在，询问用户
          Modal.confirm({
            title: '项目已存在',
            content: '检测到已存在该EPUB的项目，是否加载已有项目？',
            okText: '加载已有项目',
            cancelText: '删除并重建',
            onOk: () => {
              setCurrentProject(result.data)
              message.success('已加载现有项目')
            },
            onCancel: async () => {
              // 删除旧项目并重新创建
              await window.electronAPI.deleteProject(result.data.project.id)
              await createProject(epubPathToUse, epubDataToUse, true)
            }
          })
        } else {
          // 新项目或强制创建
          setCurrentProject(result.data)
          message.success('项目创建成功')
        }
      } else {
        message.error('创建项目失败: ' + result.error)
      }
    } catch (error) {
      message.destroy()
      console.error('创建项目失败:', error)
      message.error('创建项目失败')
    }
  }

  // 从项目列表打开已存在的项目
  const openProjectFromList = async (project: ProjectListItem) => {
    if (!window.electronAPI?.openProject) {
      message.error('openProject API 未定义')
      return
    }

    const hide = message.loading('正在打开项目...', 0)

    try {
      const result = await window.electronAPI.openProject(project.id)

      if (!result.success || !result.data) {
        throw new Error(result.error || '加载项目失败')
      }

      const { projectInfo, epubData } = result.data
      const uint8Array = Uint8Array.from(epubData)
      const arrayBuffer = uint8Array.buffer
      const projectRecord = projectInfo.project
      const displayFileName = projectRecord.epubName?.endsWith('.epub')
        ? projectRecord.epubName
        : `${projectRecord.epubName}.epub`
      const titleFromMetadata = projectRecord.metadata?.title?.trim() || ''

      // 重置与章节/分段相关的状态
      setCurrentChapterId('')
      setCurrentChapterHref('')
      setActiveChapter(null, '')
      clearSegments()
      setChaptersWithSegments([])
      setHasUnsavedChanges(false)

      // 重置阅读器状态
      setEpubData(null)
      setEpubPath('')
      setShowTranslationPanel(false)
      setFileName('')
      setMetadataTitle('')
      setCurrentLocation(0)
      setTotalLocations(0)
      setPercentage(0)

      // 设置新项目
      setCurrentProject(projectInfo)
      setEpubData(arrayBuffer)
      const originalEpubPath = `${projectInfo.project.projectPath}/original.epub`
      setEpubPath(originalEpubPath)
      setFileName(displayFileName)
      setMetadataTitle(titleFromMetadata)

      message.success('项目已打开')
    } catch (error) {
      console.error('打开项目失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`打开项目失败: ${errorMessage}`)
    } finally {
      hide()
    }
  }

  // 移除 toggleMode 函数，模式切换改由列表底部按钮控制


  // 删除当前项目
  const deleteCurrentProject = async () => {
    if (!currentProject) {
      message.error('当前没有项目')
      return
    }

    const confirmed = confirm(`确定要删除项目"${currentProject.project.id}"吗？\n此操作不可恢复！`)
    if (!confirmed) return

    try {
      const result = await window.electronAPI.deleteProject(currentProject.project.id)

      if (result.success) {
        message.success('项目已删除')
        clearProject()
        clearSegments()
        setChaptersWithSegments([])
      } else {
        message.error('删除项目失败: ' + result.error)
      }
    } catch (error) {
      console.error('删除项目失败:', error)
      message.error('删除项目失败')
    }
  }

  // 关闭文件
  const handleCloseFile = () => {
    if (!epubData) return

    // 检查是否有未保存的修改
    if (hasUnsavedChanges) {
      const confirmed = confirm('您有未保存的修改，确定要关闭吗？')
      if (!confirmed) return
    }

    setEpubData(null)
    setEpubPath('')
    setShowTranslationPanel(false)
    setFileName('')
    setMetadataTitle('')
    setBook(null)
    setRendition(null)
    setCurrentLocation(0)
    setTotalLocations(0)
    setPercentage(0)
    setCurrentChapterId('')
    setCurrentChapterHref('')

    // 清理项目和分段数据
    clearProject()
    clearSegments()
    setChaptersWithSegments([])
    setHasUnsavedChanges(false)
  }

  // 监听章节变化（从epub.js的rendition事件获取）
  useEffect(() => {
    if (rendition && book) {
      const handleRelocated = async (location: any) => {
        // 获取当前章节信息
        const currentSection = book.spine.get(location.start.cfi)
        if (currentSection) {
          setCurrentChapterId(currentSection.idref || currentSection.index.toString())
          setCurrentChapterHref(currentSection.href || '')
          console.log('当前章节:', currentSection.idref, currentSection.href)
        }
      }

      rendition.on('relocated', handleRelocated)

      return () => {
        rendition.off('relocated', handleRelocated)
      }
    }
  }, [rendition, book])

  const displayTitle = metadataTitle.trim() || fileName || 'ReadTranslate'

  useEffect(() => {
    const defaultTitle = 'ReadTranslate - 翻译阅读器'
    const dynamicTitle = metadataTitle.trim() || fileName.trim()
    document.title = dynamicTitle ? `${dynamicTitle} - 翻译阅读器` : defaultTitle
  }, [metadataTitle, fileName])

  useEffect(() => {
    if (!currentProject || !currentChapterId) {
      setActiveChapter(null, '')
      setSegments([])
      setParsed(false)
      setEditMode(false)
      setHasUnsavedChanges(false)
      return
    }

    setActiveChapter(currentChapterId, currentChapterHref)

    if (!window.electronAPI?.loadSegments) {
      console.warn('loadSegments API 未定义')
      setParsed(false)
      setEditMode(false)
      return
    }

    const loadSavedSegments = async () => {
      try {
        const result = await window.electronAPI.loadSegments(currentProject.id, currentChapterId)
        if (result.success && result.data) {
          setSegments(result.data)
          setParsed(result.data.length > 0)
          setHasUnsavedChanges(false)
        } else {
          setSegments([])
          setParsed(false)
          setHasUnsavedChanges(false)
        }
        setEditMode(false)
      } catch (error) {
        console.error('加载章节分段失败:', error)
        setSegments([])
        setParsed(false)
        setEditMode(false)
        setHasUnsavedChanges(false)
      }
    }

    void loadSavedSegments()
  }, [
    currentProject,
    currentChapterId,
    currentChapterHref,
    setActiveChapter,
    setSegments,
    setParsed,
    setEditMode,
    setHasUnsavedChanges
  ])

  useEffect(() => {
    if (!currentProject) {
      setChaptersWithSegments([])
      return
    }

    if (!window.electronAPI?.listSegmentChapters) {
      console.warn('listSegmentChapters API 未定义')
      return
    }

    const loadChapterMarkers = async () => {
      try {
        console.log('开始加载章节分段状态，项目ID:', currentProject.id)
        const result = await window.electronAPI.listSegmentChapters(currentProject.id)
        console.log('加载章节分段状态结果:', result)
        if (result.success && result.data) {
          const chapterHrefs = result.data
            .map(item => item.chapterHref)
            .filter(Boolean)
          console.log('已保存分段的章节:', chapterHrefs)
          setChaptersWithSegments(chapterHrefs)
        } else {
          setChaptersWithSegments([])
        }
      } catch (error) {
        console.error('加载章节分段状态失败:', error)
        setChaptersWithSegments([])
      }
    }

    void loadChapterMarkers()
  }, [currentProject, setChaptersWithSegments])

  return (
    <Layout className="h-screen">
      <Header className="bg-white border-b border-gray-200 px-4 flex items-center justify-between h-14">
        <div className="text-lg font-semibold">{displayTitle}</div>

        <Space>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setShowSettingsModal(true)}
          >
            翻译设置
          </Button>
          <Button onClick={handleOpenFile}>打开</Button>
          <Button onClick={handleCloseFile} disabled={!epubData}>
            关闭
          </Button>

          {/* 标注栏按钮：控制右侧面板显示/隐藏 */}
          {epubData && (
            <Button
              icon={showTranslationPanel ? <CloseOutlined /> : <FileTextOutlined />}
              onClick={() => setShowTranslationPanel(!showTranslationPanel)}
            >
              标注栏
            </Button>
          )}
        </Space>
      </Header>

      <Layout className="flex-1 overflow-hidden">
        <Content className="flex h-full">
          {/* 左列：未打开文件时显示项目列表，打开后显示目录 */}
          <div className="w-64 border-r border-gray-200 bg-white overflow-auto flex-shrink-0">
            {epubData ? (
              <TableOfContents epubData={epubData} />
            ) : (
              <ProjectList onSelectProject={openProjectFromList} />
            )}
          </div>

          {/* 中列：内容展示 */}
          <div className="flex-1 bg-gray-50 overflow-auto">
            <ContentViewer epubData={epubData} />
          </div>

          {/* 右列：附注面板（可折叠） */}
          {showTranslationPanel && (
            <div className="w-80 bg-white overflow-auto flex-shrink-0 border-l border-gray-200">
              <TranslationPanel
                currentChapterId={currentChapterId}
                currentChapterHref={currentChapterHref}
              />
            </div>
          )}
        </Content>
      </Layout>

      {/* 翻译设置模态框 */}
      <TranslationSettingsModal
        open={showSettingsModal}
        onCancel={() => setShowSettingsModal(false)}
      />
    </Layout>
  )
}

export default MainLayout
