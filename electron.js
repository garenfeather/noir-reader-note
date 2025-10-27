const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const dbService = require('./services/database')
const projectService = require('./services/project')
const segmentService = require('./services/segment')
const cacheService = require('./services/cacheService')

let mainWindow = null

function createWindow() {
  // 在开发环境中，__dirname 可能指向项目根目录
  const preloadPath = path.join(__dirname, 'preload.js')
  console.log('Preload 脚本路径:', preloadPath)
  console.log('文件是否存在:', fs.existsSync(preloadPath))

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  })

  // 开发环境加载 Vite 开发服务器
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()

    // 转发渲染进程的 console 到主进程（带错误处理）
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      try {
        console.log(`[Renderer] ${message}`)
      } catch (error) {
        // 忽略 EPIPE 错误（stdout 已关闭）
        if (error.code !== 'EPIPE') {
          console.error('Console log error:', error)
        }
      }
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // 初始化数据库
  const appDataPath = app.getPath('userData')
  dbService.initializeGlobalDB(appDataPath)

  // 初始化项目服务（使用当前工作目录）
  projectService.initialize(process.cwd())

  createWindow()
})

app.on('window-all-closed', () => {
  // 关闭数据库连接
  dbService.close()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// IPC 处理：打开文件对话框
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'EPUB Files', extensions: ['epub'] },
    ],
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const fileBuffer = fs.readFileSync(filePath)
    // 将 Buffer 转换为 ArrayBuffer
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    )
    return {
      path: filePath,
      data: Array.from(new Uint8Array(arrayBuffer)), // 转为普通数组以便通过 IPC 传递
    }
  }
  return null
})

// IPC 处理：创建项目
ipcMain.handle('project:create', async (event, epubPath, epubDataArray, metadata, forceCreate = false) => {
  try {
    // 将数组转换回Buffer
    const epubBuffer = Buffer.from(epubDataArray)

    const projectInfo = await projectService.createProject(epubPath, epubBuffer, metadata, forceCreate)
    return { success: true, data: projectInfo }
  } catch (error) {
    console.error('IPC创建项目失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：删除项目
ipcMain.handle('project:delete', async (event, projectId) => {
  try {
    // 清除缓存
    cacheService.closeProjectCache(projectId)

    projectService.deleteProject(projectId)
    return { success: true }
  } catch (error) {
    console.error('IPC删除项目失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：获取项目信息
// IPC 处理：获取项目列表（从文件系统）
ipcMain.handle('project:listFromDisk', async (event) => {
  try {
    if (!projectService.projectsRoot) {
      throw new Error('项目根目录未初始化')
    }

    const projectsDir = projectService.projectsRoot

    // 检查目录是否存在
    if (!fs.existsSync(projectsDir)) {
      return { success: true, data: [] }
    }

    // 读取目录中的文件夹
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true })
    const projects = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const projectId = entry.name
      const projectPath = path.join(projectsDir, projectId)
      const originalEpubPath = path.join(projectPath, 'original.epub')

      // 检查原始EPUB文件是否存在
      if (!fs.existsSync(originalEpubPath)) continue

      // 提取标题（去掉MD5部分）
      const parts = projectId.split('-')
      let displayTitle = projectId
      if (parts.length > 1 && parts[parts.length - 1].length === 8) {
        displayTitle = parts.slice(0, -1).join('-')
      }

      const stats = fs.statSync(projectPath)
      const updatedAt = stats.mtime ? stats.mtime.toISOString() : null
      const createdAt = stats.birthtime ? stats.birthtime.toISOString() : null

      projects.push({
        id: projectId,
        epubName: path.basename(originalEpubPath),
        epubPath: originalEpubPath,
        projectPath: projectPath,
        displayTitle: displayTitle,
        createdAt,
        updatedAt,
        metadata: null
      })
    }

    // 按项目ID排序（使displayTitle相同的项目靠在一起）
    projects.sort((a, b) => a.id.localeCompare(b.id))

    return { success: true, data: projects }
  } catch (error) {
    console.error('IPC从文件系统获取项目列表失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：打开已存在的项目
ipcMain.handle('project:open', async (event, projectId) => {
  try {
    const projectInfo = projectService.getProject(projectId)
    if (!projectInfo) {
      throw new Error('项目不存在')
    }

    const originalEpubPath = path.join(projectInfo.project.projectPath, 'original.epub')
    const fileBuffer = fs.readFileSync(originalEpubPath)
    const epubDataArray = Array.from(new Uint8Array(fileBuffer))

    return {
      success: true,
      data: {
        projectInfo,
        epubData: epubDataArray
      }
    }
  } catch (error) {
    console.error('IPC打开项目失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：保存分段
ipcMain.handle('segments:save', async (event, projectId, segments) => {
  console.log('📨 IPC: segments:save 收到请求')
  console.log('📦 参数:', { projectId, segmentsCount: segments.length })

  try {
    console.log('🔄 调用 dbService.saveSegments...')
    dbService.saveSegments(projectId, segments)
    console.log('✅ saveSegments 执行完成')
    return { success: true }
  } catch (error) {
    console.error('❌ IPC保存分段失败:', error)
    console.error('Stack:', error.stack)
    return { success: false, error: error.message }
  }
})

// IPC 处理：加载分段
ipcMain.handle('segments:load', async (event, projectId, chapterId) => {
  console.log('📥 IPC: segments:load 收到请求', { projectId, chapterId })
  try {
    const segments = dbService.loadSegments(projectId, chapterId)
    console.log(`📥 IPC: 加载了 ${segments.length} 个分段`)
    if (segments.length > 0) {
      console.log('📥 IPC: 第一个分段的 CFI:', segments[0].cfiRange?.substring(0, 50))
    }
    return { success: true, data: segments }
  } catch (error) {
    console.error('IPC加载分段失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：获取已有分段的章节列表
ipcMain.handle('segments:listChapters', async (event, projectId) => {
  try {
    const chapters = dbService.getChaptersWithSegments(projectId)
    return { success: true, data: chapters }
  } catch (error) {
    console.error('IPC获取章节分段状态失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：解析章节段落
ipcMain.handle('segments:parse', async (event, projectId, chapterId, chapterHref) => {
  try {
    // 获取项目信息
    const projectInfo = projectService.getProject(projectId)
    if (!projectInfo) {
      throw new Error('项目不存在')
    }

    // 查找OPF文件以获取基础路径
    const extractedPath = path.join(projectInfo.project.projectPath, 'extracted')
    const opfPath = projectService.findOPFFile(extractedPath)
    if (!opfPath) {
      throw new Error('找不到OPF文件')
    }

    // OPF文件所在目录作为基础路径
    const opfDir = path.dirname(opfPath)

    // 构建xhtml文件路径（相对于OPF文件所在目录）
    const xhtmlPath = path.join(opfDir, chapterHref)

    console.log('解析章节:', { chapterHref, opfDir, xhtmlPath })

    // 解析段落
    const result = segmentService.parseXhtml(xhtmlPath, chapterId, chapterHref, projectId)

    // 清除该项目的缓存
    cacheService.clearProjectCache(projectId)
    console.log('分割时已清除项目缓存:', projectId)

    return { success: true, data: result }
  } catch (error) {
    console.error('IPC解析分段失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：通过xpath获取分段文本
ipcMain.handle('segments:getSegmentText', async (event, projectId, chapterHref, xpath) => {
  try {
    console.log('IPC segments:getSegmentText 收到请求', { projectId, chapterHref, xpath })

    const projectInfo = projectService.getProject(projectId)
    if (!projectInfo) {
      throw new Error('项目不存在')
    }

    // 初始化该项目的缓存数据库（如果未初始化）
    cacheService.initializeProjectCache(projectInfo.project.projectPath, projectId)

    // 第一步：尝试从缓存读取
    const cachedText = cacheService.getSegmentTextFromCache(projectId, chapterHref, xpath)
    if (cachedText) {
      console.log('IPC: 从缓存返回文本', { length: cachedText.length })
      return { success: true, data: { text: cachedText, fromCache: true } }
    }

    // 第二步：缓存未命中，从文件读取
    const extractedPath = path.join(projectInfo.project.projectPath, 'extracted')
    const opfPath = projectService.findOPFFile(extractedPath)
    if (!opfPath) {
      throw new Error('找不到OPF文件')
    }

    console.log('IPC: OPF文件已找到', opfPath)

    const opfDir = path.dirname(opfPath)
    const xhtmlPath = path.join(opfDir, chapterHref)

    console.log('IPC: 从文件读取文本', xhtmlPath)

    // 获取分段文本
    const text = segmentService.getSegmentTextByXPath(xhtmlPath, xpath)

    console.log('IPC: 分段文本已获取', { length: text.length })

    // 第三步：保存到缓存
    cacheService.saveSegmentTextToCache(projectId, chapterHref, xpath, text)

    return { success: true, data: { text, fromCache: false } }
  } catch (error) {
    console.error('IPC获取分段文本失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：翻译分段（Mock 实现）
ipcMain.handle('segments:translate', async (event, originalText) => {
  try {
    console.log('IPC segments:translate 收到请求', { textLength: originalText?.length })

    if (!originalText) {
      throw new Error('缺少原文参数')
    }

    // Mock 翻译逻辑：
    // 1. 译文 = 原文（保持不变）
    const translatedText = originalText

    // 2. 附注 = 随机提取词汇生成
    const notes = []

    // 简单分词（按空格和标点分割）
    const words = originalText
      .split(/[\s\p{P}]+/u)
      .filter(word => word.length > 3) // 只保留长度 > 3 的词
      .slice(0, 10) // 最多取 10 个词

    // 随机选择 2-4 个词生成附注
    const noteCount = Math.min(words.length, Math.floor(Math.random() * 3) + 2)
    const selectedWords = []

    // 随机选择不重复的词
    while (selectedWords.length < noteCount && selectedWords.length < words.length) {
      const randomWord = words[Math.floor(Math.random() * words.length)]
      if (!selectedWords.includes(randomWord)) {
        selectedWords.push(randomWord)
      }
    }

    // 生成附注
    selectedWords.forEach(word => {
      notes.push({
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: `【${word}】的注释说明`,
        timestamp: Date.now()
      })
    })

    console.log('IPC: 翻译完成（Mock）', {
      translatedLength: translatedText.length,
      notesCount: notes.length
    })

    return {
      success: true,
      data: {
        translatedText,
        notes
      }
    }
  } catch (error) {
    console.error('IPC翻译分段失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：保存分段的译文和附注
ipcMain.handle('segments:saveNotes', async (event, segmentId, translatedText, notes) => {
  try {
    console.log('IPC segments:saveNotes 收到请求', {
      segmentId,
      hasTranslation: !!translatedText,
      notesCount: notes?.length || 0
    })

    if (!segmentId) {
      throw new Error('缺少分段ID参数')
    }

    const db = databaseService
    db.updateSegmentNotes(segmentId, translatedText, notes)

    console.log('IPC: 保存译文和附注成功')

    return { success: true }
  } catch (error) {
    console.error('IPC保存译文和附注失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：删除分段
ipcMain.handle('segments:delete', async (event, segmentId) => {
  try {
    console.log('IPC segments:delete 收到请求', { segmentId })

    if (!segmentId) {
      throw new Error('缺少分段ID参数')
    }

    const db = databaseService
    const deleted = db.deleteSegment(segmentId)

    if (!deleted) {
      throw new Error('分段不存在或已被删除')
    }

    console.log('IPC: 删除分段成功')

    return { success: true }
  } catch (error) {
    console.error('IPC删除分段失败:', error)
    return { success: false, error: error.message }
  }
})
