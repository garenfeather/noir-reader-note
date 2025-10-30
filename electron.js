console.log('🚀 electron.js 开始执行')

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

console.log('📦 开始加载服务模块')
const dbService = require('./services/database')
const projectService = require('./services/project')
const segmentService = require('./services/segment')
const cacheService = require('./services/cacheService')
const translationService = require('./services/translationService')
console.log('✅ 服务模块加载完成')
console.log('📂 projectService.projectsRoot 初始值:', projectService.projectsRoot)

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

console.log('📝 注册 app.whenReady 回调')

app.whenReady().then(() => {
  console.log('✅ app.whenReady 触发！')

  // 初始化数据库
  const appDataPath = app.getPath('userData')
  console.log('📁 应用数据目录:', appDataPath)
  dbService.initializeGlobalDB(appDataPath)

  // 初始化项目服务（使用当前工作目录）
  const currentDir = process.cwd()
  console.log('📁 当前工作目录:', currentDir)
  console.log('🔧 调用 projectService.initialize...')
  projectService.initialize(currentDir)
  console.log('✅ projectService.initialize 完成')
  console.log('📂 projectService.projectsRoot:', projectService.projectsRoot)

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
      console.warn('项目根目录尚未初始化，返回空列表')
      return { success: true, data: [] }
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

// IPC 处理：翻译分段（使用Gemini API）
ipcMain.handle('segments:translate', async (event, originalText) => {
  try {
    console.log('IPC segments:translate 收到请求', { textLength: originalText?.length })

    if (!originalText) {
      throw new Error('缺少原文参数')
    }

    // 调用翻译服务
    console.log('IPC: 正在调用翻译服务...')
    const result = await translationService.translate(originalText)

    console.log('IPC: 翻译服务返回', {
      translation: result.translation?.substring(0, 50),
      notesCount: result.notes?.length,
      language: result.language
    })

    // 转换notes格式：从 {item, content} 转为 {id, text, timestamp}
    const notes = (result.notes || []).map(note => ({
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: `【${note.item}】${note.content}`,
      timestamp: Date.now()
    }))

    console.log('IPC: 翻译完成', {
      translatedLength: result.translation?.length,
      notesCount: notes.length
    })

    return {
      success: true,
      data: {
        translatedText: result.translation,
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

    dbService.updateSegmentNotes(segmentId, translatedText, notes)

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

    const deleted = dbService.deleteSegment(segmentId)

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

// IPC 处理：清空章节所有分段
ipcMain.handle('segments:clearChapter', async (event, projectId, chapterId) => {
  try {
    console.log('IPC segments:clearChapter 收到请求', { projectId, chapterId })

    if (!projectId || !chapterId) {
      throw new Error('缺少项目ID或章节ID参数')
    }

    const deletedCount = dbService.deleteChapterSegments(projectId, chapterId)

    console.log('IPC: 清空章节分段成功，删除数量:', deletedCount)

    return { success: true, deletedCount }
  } catch (error) {
    console.error('IPC清空章节分段失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：获取翻译配置
ipcMain.handle('translation:getConfig', async (event) => {
  try {
    console.log('IPC translation:getConfig 收到请求')

    const config = translationService.getConfig()

    console.log('IPC: 返回翻译配置')

    return { success: true, data: config }
  } catch (error) {
    console.error('IPC获取翻译配置失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：保存翻译配置
ipcMain.handle('translation:saveConfig', async (event, config) => {
  try {
    console.log('IPC translation:saveConfig 收到请求', config)

    // 目前暂时不实现配置保存功能，只返回成功
    // 后续可以添加将配置写入文件的逻辑

    console.log('IPC: 配置保存成功（暂不持久化）')

    return { success: true }
  } catch (error) {
    console.error('IPC保存翻译配置失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：添加书签
ipcMain.handle('bookmarks:add', async (event, segmentId) => {
  try {
    console.log('IPC bookmarks:add 收到请求', { segmentId })

    if (!segmentId) {
      throw new Error('缺少分段ID参数')
    }

    const bookmarkId = dbService.addBookmark(segmentId)

    if (bookmarkId === null) {
      return { success: false, error: '该附注已收藏' }
    }

    console.log('IPC: 添加书签成功')

    return { success: true, data: { bookmarkId } }
  } catch (error) {
    console.error('IPC添加书签失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：删除书签
ipcMain.handle('bookmarks:remove', async (event, segmentId) => {
  try {
    console.log('IPC bookmarks:remove 收到请求', { segmentId })

    if (!segmentId) {
      throw new Error('缺少分段ID参数')
    }

    const removed = dbService.removeBookmark(segmentId)

    if (!removed) {
      return { success: false, error: '书签不存在' }
    }

    console.log('IPC: 删除书签成功')

    return { success: true }
  } catch (error) {
    console.error('IPC删除书签失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：获取书签列表
ipcMain.handle('bookmarks:getAll', async (event) => {
  try {
    console.log('IPC bookmarks:getAll 收到请求')

    const bookmarks = dbService.getBookmarks()

    console.log('IPC: 获取书签列表成功，共', bookmarks.length, '条')

    return { success: true, data: bookmarks }
  } catch (error) {
    console.error('IPC获取书签列表失败:', error)
    return { success: false, error: error.message }
  }
})

// IPC 处理：检查是否已收藏
ipcMain.handle('bookmarks:isBookmarked', async (event, segmentId) => {
  try {
    console.log('IPC bookmarks:isBookmarked 收到请求', { segmentId })

    if (!segmentId) {
      throw new Error('缺少分段ID参数')
    }

    const isBookmarked = dbService.isBookmarked(segmentId)

    console.log('IPC: 检查书签状态完成，结果:', isBookmarked)

    return { success: true, data: { isBookmarked } }
  } catch (error) {
    console.error('IPC检查书签状态失败:', error)
    return { success: false, error: error.message }
  }
})
