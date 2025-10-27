/**
 * 项目管理服务
 * 处理项目创建、EPUB解压等操作
 */

const AdmZip = require('adm-zip')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const dbService = require('./database')

// 使用 Node.js crypto 生成 UUID
function uuidv4() {
  return crypto.randomUUID()
}

class ProjectService {
  constructor() {
    this.projectsRoot = null
  }

  /**
   * 初始化项目根目录
   */
  initialize(appPath) {
    console.log('🔧 ProjectService.initialize 被调用, appPath:', appPath)

    if (!appPath) {
      console.error('❌ appPath 为空，无法初始化项目根目录')
      return
    }

    // 项目保存在应用根目录的projects文件夹
    this.projectsRoot = path.join(appPath, 'projects')

    console.log('📁 项目根目录设置为:', this.projectsRoot)

    if (!fs.existsSync(this.projectsRoot)) {
      fs.mkdirSync(this.projectsRoot, { recursive: true })
      console.log('✅ 创建项目根目录:', this.projectsRoot)
    } else {
      console.log('✅ 项目根目录已存在:', this.projectsRoot)
    }
  }

  /**
   * 生成项目ID（基于标题和MD5）
   */
  generateProjectId(epubData, metadata, epubPath = '') {
    // 计算文件MD5
    const hash = crypto.createHash('md5')
    hash.update(epubData)
    const md5 = hash.digest('hex').substring(0, 8) // 取前8位

    // 标题逻辑与左上角显示一致：优先元数据title，再用文件名，最后默认untitled
    let title = metadata?.title?.trim() || ''
    if (!title && epubPath) {
      title = path.basename(epubPath, '.epub').trim()
    }
    if (!title) {
      title = 'untitled'
    }

    // 清理标题，移除特殊字符
    const cleanTitle = title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 50)

    return `${cleanTitle}-${md5}`
  }

  /**
   * 检查项目是否已存在
   */
  checkProjectExists(projectId) {
    const project = dbService.getProject(projectId)
    if (project) {
      const projectPath = path.join(this.projectsRoot, projectId)
      // 检查项目目录是否存在
      if (fs.existsSync(projectPath)) {
        return { exists: true, project }
      }
    }
    return { exists: false, project: null }
  }

  /**
   * 创建新项目
   * @param {string} epubPath - EPUB文件路径
   * @param {Buffer} epubData - EPUB文件数据
   * @param {Object} metadata - EPUB元数据
   * @param {boolean} forceCreate - 强制创建（删除旧项目）
   */
  async createProject(epubPath, epubData, metadata = null, forceCreate = false) {
    try {
      console.log('🚀 createProject 被调用')
      console.log('📂 this.projectsRoot:', this.projectsRoot)

      // 0. 检查项目根目录是否已初始化
      if (!this.projectsRoot) {
        console.error('❌ projectsRoot 为空！')
        throw new Error('项目服务未初始化，请重启应用')
      }

      // 1. 生成项目ID
      const projectId = this.generateProjectId(epubData, metadata, epubPath)

      // 2. 检查项目是否已存在
      const checkResult = this.checkProjectExists(projectId)
      if (checkResult.exists && !forceCreate) {
        return {
          exists: true,
          project: checkResult.project,
          extractedPath: path.join(this.projectsRoot, projectId, 'extracted'),
          originalEpubPath: path.join(this.projectsRoot, projectId, 'original.epub')
        }
      }

      // 3. 如果强制创建，先删除旧项目
      if (forceCreate && checkResult.exists) {
        console.log('删除旧项目:', projectId)
        this.deleteProject(projectId)
      }

      // 4. 创建项目目录
      const projectPath = path.join(this.projectsRoot, projectId)
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true })
      }

      console.log('创建项目目录:', projectPath)

      // 5. 复制原始EPUB文件
      const originalEpubPath = path.join(projectPath, 'original.epub')
      fs.writeFileSync(originalEpubPath, epubData)
      console.log('复制EPUB文件到:', originalEpubPath)

      // 6. 解压EPUB
      const extractedPath = path.join(projectPath, 'extracted')
      this.extractEpub(originalEpubPath, extractedPath)
      console.log('EPUB解压完成:', extractedPath)

      // 7. 创建数据库记录
      const epubName = epubPath ? path.basename(epubPath, '.epub') : 'untitled'
      const project = {
        id: projectId,
        epubName: epubName,
        epubPath: epubPath || '',
        projectPath: projectPath,
        metadata: metadata
      }

      dbService.createProject(project)

      // 8. 返回项目信息
      return {
        exists: false,
        project: {
          ...project,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        extractedPath: extractedPath,
        originalEpubPath: originalEpubPath
      }
    } catch (error) {
      console.error('创建项目失败:', error)
      throw error
    }
  }

  /**
   * 解压EPUB文件
   */
  extractEpub(epubPath, extractPath) {
    try {
      const zip = new AdmZip(epubPath)

      // 确保解压目录存在
      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true })
      }

      // 解压所有文件
      zip.extractAllTo(extractPath, true)

      console.log(`EPUB解压成功: ${epubPath} -> ${extractPath}`)
      return extractPath
    } catch (error) {
      console.error('解压EPUB失败:', error)
      throw error
    }
  }

  /**
   * 获取项目信息
   */
  getProject(projectId) {
    try {
      const project = dbService.getProject(projectId)
      if (!project) {
        return null
      }

      const extractedPath = path.join(project.projectPath, 'extracted')
      const originalEpubPath = path.join(project.projectPath, 'original.epub')

      return {
        project,
        extractedPath,
        originalEpubPath
      }
    } catch (error) {
      console.error('获取项目失败:', error)
      return null
    }
  }

  /**
   * 检查项目是否存在
   */
  projectExists(projectId) {
    const projectPath = path.join(this.projectsRoot, projectId)
    return fs.existsSync(projectPath)
  }

  /**
   * 获取解压后的内容路径（用于查找xhtml文件）
   */
  getExtractedPath(projectId) {
    const projectPath = path.join(this.projectsRoot, projectId)
    return path.join(projectPath, 'extracted')
  }

  /**
   * 查找EPUB的OPF文件（用于获取spine信息）
   */
  findOPFFile(extractedPath) {
    try {
      // 读取META-INF/container.xml获取OPF文件路径
      const containerPath = path.join(extractedPath, 'META-INF', 'container.xml')

      if (!fs.existsSync(containerPath)) {
        console.error('container.xml不存在')
        return null
      }

      const containerXml = fs.readFileSync(containerPath, 'utf-8')

      // 简单的正则匹配获取OPF路径
      const match = containerXml.match(/full-path="([^"]+)"/)
      if (match && match[1]) {
        const opfPath = path.join(extractedPath, match[1])
        console.log('找到OPF文件:', opfPath)
        return opfPath
      }

      return null
    } catch (error) {
      console.error('查找OPF文件失败:', error)
      return null
    }
  }

  /**
   * 删除项目
   */
  deleteProject(projectId) {
    try {
      // 删除数据库记录
      dbService.deleteProject(projectId)

      // 删除项目目录
      const projectPath = path.join(this.projectsRoot, projectId)
      if (fs.existsSync(projectPath)) {
        fs.rmSync(projectPath, { recursive: true, force: true })
        console.log('项目目录删除成功:', projectPath)
      }

      return true
    } catch (error) {
      console.error('删除项目失败:', error)
      throw error
    }
  }
}

// 单例模式
const projectService = new ProjectService()

module.exports = projectService
