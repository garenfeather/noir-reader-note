/**
 * 数据库服务 - SQLite数据库操作
 * 在Electron主进程中运行
 */

const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const { JSDOM } = require('jsdom')
const segmentService = require('./segment')

class DatabaseService {
  constructor() {
    this.db = null
    this.dbPath = null
  }

  /**
   * 将数据库中的 CFI JSON 字符串解析为数组
   * @param {string|null} value - 数据库存储的 JSON 字符串
   * @returns {string[]} 解析后的 CFI 列表
   */
  parseCfiArray(value) {
    if (!value) return []
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      if (Array.isArray(parsed)) {
        return parsed.filter((cfi) => typeof cfi === 'string' && cfi.trim().length > 0)
      }
      return []
    } catch (error) {
      console.warn('解析 CFI 列表失败，返回空数组:', { value, error: error.message })
      return []
    }
  }

  /**
   * 初始化全局数据库（应用启动时调用）
   * 创建项目表和分段表
   */
  initializeGlobalDB(appDataPath) {
    const dbDir = path.join(appDataPath, 'database')

    // 确保数据库目录存在
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    this.dbPath = path.join(dbDir, 'app.db')

    try {
      this.db = new Database(this.dbPath)
    } catch (error) {
      console.error('初始化数据库失败:', error.message)
      console.error('请运行: npm rebuild better-sqlite3')
      throw new Error('数据库初始化失败，请检查日志')
    }

    console.log('初始化全局数据库:', this.dbPath)

    // 创建项目表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        epub_name TEXT NOT NULL,
        epub_path TEXT NOT NULL,
        project_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `)

    // 创建分段表
    // 新增字段支持译文和附注功能
    // 原文通过xpath动态读取，不存储在数据库中
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS segments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        chapter_href TEXT NOT NULL,
        xpath TEXT NOT NULL,
        end_xpath TEXT,
        cfi_range TEXT,
        position REAL NOT NULL,
        is_empty BOOLEAN DEFAULT 0,
        parent_segment_id TEXT,
        preview TEXT,
        text_length INTEGER DEFAULT 0,
        translated_text TEXT,
        notes TEXT,
        is_modified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // 为已有数据库添加 end_xpath 字段（如果不存在）
    try {
      this.db.exec(`ALTER TABLE segments ADD COLUMN end_xpath TEXT`)
      console.log('已添加 end_xpath 字段')
    } catch (error) {
      // 字段已存在，忽略错误
      if (!error.message.includes('duplicate column')) {
        console.error('添加 end_xpath 字段失败:', error)
      }
    }

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_segments_project
      ON segments(project_id)
    `)

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_segments_chapter
      ON segments(chapter_id)
    `)

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_segments_position
      ON segments(project_id, chapter_id, position)
    `)

    // 创建书签表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        segment_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
      )
    `)

    // 创建书签索引
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_segment
      ON bookmarks(segment_id)
    `)

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_bookmarks_created
      ON bookmarks(created_at)
    `)

    console.log('数据库表结构创建完成')
  }

  /**
   * 创建项目记录
   */
  createProject(project) {
    if (!this.db) {
      throw new Error('数据库未初始化')
    }

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, epub_name, epub_path, project_path, metadata)
      VALUES (?, ?, ?, ?, ?)
    `)

    const metadata = project.metadata ? JSON.stringify(project.metadata) : null

    try {
      stmt.run(
        project.id,
        project.epubName,
        project.epubPath,
        project.projectPath,
        metadata
      )
      console.log('项目记录创建成功:', project.id)
      return true
    } catch (error) {
      console.error('创建项目记录失败:', error)
      throw error
    }
  }

  /**
   * 获取项目信息
   */
  getProject(projectId) {
    if (!this.db) {
      console.error('数据库未初始化')
      return null
    }

    const stmt = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `)

    try {
      const row = stmt.get(projectId)
      if (!row) return null

      return {
        id: row.id,
        epubName: row.epub_name,
        epubPath: row.epub_path,
        projectPath: row.project_path,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }
    } catch (error) {
      console.error('获取项目失败:', error)
      return null
    }
  }

  /**
   * 获取所有项目
   */
  getAllProjects() {
    const stmt = this.db.prepare(`
      SELECT * FROM projects ORDER BY updated_at DESC
    `)

    try {
      const rows = stmt.all()
      return rows.map(row => ({
        id: row.id,
        epubName: row.epub_name,
        epubPath: row.epub_path,
        projectPath: row.project_path,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }))
    } catch (error) {
      console.error('获取项目列表失败:', error)
      return []
    }
  }

  /**
   * 更新项目信息
   */
  updateProject(projectId, updates) {
    const stmt = this.db.prepare(`
      UPDATE projects
      SET updated_at = CURRENT_TIMESTAMP,
          metadata = ?
      WHERE id = ?
    `)

    try {
      const metadata = updates.metadata ? JSON.stringify(updates.metadata) : null
      stmt.run(metadata, projectId)
      console.log('项目更新成功:', projectId)
      return true
    } catch (error) {
      console.error('更新项目失败:', error)
      throw error
    }
  }

  /**
   * 保存分段数据（批量）
   * 支持译文和附注功能
   * 保存前生成 CFI Range
   */
  saveSegments(projectId, segments) {
    console.log(`开始保存 segments，共 ${segments.length} 个`)

    // 在保存前生成 CFI（使用 OPF 文件获取 spine 信息）
    this.generateCFIForSegments(projectId, segments)

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO segments
      (id, project_id, chapter_id, chapter_href, xpath, end_xpath, cfi_range, position, is_empty, parent_segment_id, preview, text_length, translated_text, notes, is_modified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // 使用事务确保数据一致性
    const transaction = this.db.transaction((segments) => {
      for (const segment of segments) {
        // 将 notes、CFI 数组转换为 JSON 字符串
        const notesJSON = segment.notes ? JSON.stringify(segment.notes) : null
        const cfiRanges = Array.isArray(segment.cfiRanges)
          ? segment.cfiRanges.filter((cfi) => typeof cfi === 'string' && cfi.trim().length > 0)
          : []
        const cfiJSON = JSON.stringify(cfiRanges)

        stmt.run(
          segment.id,
          projectId,
          segment.chapterId,
          segment.chapterHref,
          segment.xpath,
          segment.endXPath || null,
          cfiJSON,
          segment.position,
          segment.isEmpty ? 1 : 0,
          segment.parentSegmentId || null,
          segment.preview || null,
          segment.textLength || 0,
          segment.translatedText || null,
          notesJSON,
          segment.isModified ? 1 : 0
        )
      }
    })

    try {
      transaction(segments)
      console.log(`保存了 ${segments.length} 个分段`)
      return true
    } catch (error) {
      console.error('保存分段失败:', error)
      throw error
    }
  }

  /**
   * 解析 OPF 文件，获取 spine 映射
   * @param {string} opfPath - OPF 文件路径
   * @returns {Object} { spineNodeIndex, spineMap: { idref -> { index, id, href } } }
   */
  parseOPFSpine(opfPath) {
    try {
      const opfContent = fs.readFileSync(opfPath, 'utf-8')
      const { JSDOM } = require('jsdom')
      const dom = new JSDOM(opfContent, { contentType: 'text/xml' })
      const doc = dom.window.document

      // 获取 spine 节点在 package 中的位置（通常是第3个子元素，index=2）
      const packageElement = doc.querySelector('package')
      if (!packageElement) {
        console.error('❌ 找不到 package 元素')
        return null
      }

      let spineNodeIndex = 0
      const children = Array.from(packageElement.children)
      for (let i = 0; i < children.length; i++) {
        if (children[i].tagName.toLowerCase() === 'spine') {
          spineNodeIndex = i
          break
        }
      }

      // 获取 manifest（id -> href 映射）
      const manifestItems = doc.querySelectorAll('manifest > item')
      const manifestMap = {}
      manifestItems.forEach(item => {
        const id = item.getAttribute('id')
        const href = item.getAttribute('href')
        if (id && href) {
          manifestMap[id] = href
        }
      })

      // 获取 spine（idref -> index 映射）
      const itemrefs = doc.querySelectorAll('spine > itemref')
      const spineMap = {}
      itemrefs.forEach((itemref, index) => {
        const idref = itemref.getAttribute('idref')
        if (idref) {
          spineMap[idref] = {
            index: index,
            id: idref,
            href: manifestMap[idref] || null
          }
        }
      })

      console.log(`✅ OPF 解析完成，spine包含 ${Object.keys(spineMap).length} 个章节`)

      return { spineNodeIndex, spineMap }
    } catch (error) {
      console.error('❌ 解析 OPF 失败:', error)
      return null
    }
  }

  /**
   * 生成 cfiBase
   * @param {number} spineNodeIndex - spine 节点在 package 中的索引
   * @param {number} spineItemIndex - 章节在 spine 中的索引
   * @param {string} id - 章节 ID
   * @returns {string} cfiBase，例如：/6/8[c1_1t.xhtml]
   */
  generateCFIBase(spineNodeIndex, spineItemIndex, id) {
    const spinePath = (spineNodeIndex + 1) * 2
    const itemPath = (spineItemIndex + 1) * 2
    let cfiBase = `/${spinePath}/${itemPath}`
    if (id) {
      cfiBase += `[${id}]`
    }
    return cfiBase
  }

  /**
   * 为 segments 生成 CFI Range
   * 按章节分组，避免重复加载 XHTML
   * @param {string} projectId - 项目ID
   * @param {Array} segments - 分段数组
   */
  generateCFIForSegments(projectId, segments) {
    console.log('🔧 generateCFIForSegments 开始执行', { projectId, segmentsCount: segments.length })

    try {
      // 获取项目解压路径
      const project = this.getProject(projectId)
      console.log('📁 项目信息:', project)

      if (!project) {
        console.error('❌ generateCFIForSegments: 项目不存在', projectId)
        return
      }

      // 构建解压路径: projectPath + '/extracted'
      const extractedPath = path.join(project.projectPath, 'extracted')
      console.log('📂 解压路径:', extractedPath)

      // 查找并解析 OPF 文件
      const projectService = require('./project')
      const opfPath = projectService.findOPFFile(extractedPath)
      if (!opfPath) {
        console.error('❌ 找不到 OPF 文件')
        return
      }

      console.log('📄 OPF 文件:', opfPath)
      const opfData = this.parseOPFSpine(opfPath)
      if (!opfData) {
        console.error('❌ 解析 OPF 失败')
        return
      }

      const { spineNodeIndex, spineMap } = opfData

      // 按章节分组
      const segmentsByChapter = segments.reduce((acc, segment) => {
        const key = segment.chapterHref
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(segment)
        return acc
      }, {})

      console.log('📚 章节分组:', Object.keys(segmentsByChapter))

      let successCount = 0
      let failCount = 0

      // 遍历每个章节
      for (const [chapterHref, chapterSegments] of Object.entries(segmentsByChapter)) {
        console.log(`\n📖 处理章节: ${chapterHref} (${chapterSegments.length} 个段落)`)

        try {
          // 构建 XHTML 文件路径
          let xhtmlPath = path.join(extractedPath, chapterHref)

          // 🔧 修复：如果文件不存在，尝试添加 OEBPS/ 前缀
          if (!fs.existsSync(xhtmlPath)) {
            const oebpsPath = path.join(extractedPath, 'OEBPS', chapterHref)
            if (fs.existsSync(oebpsPath)) {
              console.log('🔧 修复路径: 添加 OEBPS/ 前缀')
              xhtmlPath = oebpsPath
            }
          }

          console.log('📄 XHTML 路径:', xhtmlPath)

          if (!fs.existsSync(xhtmlPath)) {
            console.error(`❌ XHTML 文件不存在: ${xhtmlPath}`)
            failCount += chapterSegments.length
            continue
          }

          // 读取并解析 XHTML
          const html = fs.readFileSync(xhtmlPath, 'utf-8')
          const dom = new JSDOM(html, { contentType: 'text/html' })
          const document = dom.window.document

          // 根据 chapterHref 查找 spine 信息
          let spineInfo = null
          for (const [idref, info] of Object.entries(spineMap)) {
            if (info.href === chapterHref) {
              spineInfo = info
              break
            }
          }

          if (!spineInfo) {
            console.error(`❌ 找不到章节的 spine 信息: ${chapterHref}`)
            failCount += chapterSegments.length
            continue
          }

          // 生成 cfiBase
          const cfiBase = this.generateCFIBase(spineNodeIndex, spineInfo.index, spineInfo.id)

          // 为该章节的每个 segment 生成 CFI
          let chapterSuccessCount = 0
          let chapterFailCount = 0

          for (const segment of chapterSegments) {
            try {
              // 通过 XPath 找到元素
              const element = segmentService.getElementByXPath(document, segment.xpath)

              if (element) {
                // 生成 CFI（传入 cfiBase）
                const cfiRange = segmentService.generateCFI(element, cfiBase)

                if (cfiRange) {
                  segment.cfiRanges = [cfiRange]
                  successCount++
                  chapterSuccessCount++
                } else {
                  segment.cfiRanges = []
                  failCount++
                  chapterFailCount++
                }
              } else {
                console.error(`  ❌ 未找到元素: ${segment.xpath}`)
                segment.cfiRanges = []
                failCount++
                chapterFailCount++
              }
            } catch (error) {
              console.error(`  ❌ 生成CFI异常:`, error.message)
              segment.cfiRanges = []
              failCount++
              chapterFailCount++
            }
          }

          console.log(`  📊 本章统计: 成功 ${chapterSuccessCount}, 失败 ${chapterFailCount}`)
        } catch (error) {
          console.error('generateCFIForSegments: 处理章节失败', {
            chapterHref,
            error: error.message
          })
          failCount += chapterSegments.length
        }
      }

      console.log(`\n🎉 CFI 生成完成: 成功 ${successCount} 个，失败 ${failCount} 个`)
      console.log(`📈 成功率: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`)
    } catch (error) {
      console.error('❌ generateCFIForSegments: 生成 CFI 失败', error)
      console.error('Stack:', error.stack)
      // 不抛出异常，允许继续保存（CFI 为 null）
    }
  }

  /**
   * 加载章节的分段数据
   * 包含译文和附注信息
   * 原文通过xpath动态读取，不从数据库返回
   */
  loadSegments(projectId, chapterId) {
    const stmt = this.db.prepare(`
      SELECT id, project_id, chapter_id, chapter_href, xpath, end_xpath, cfi_range, position,
             is_empty, parent_segment_id, preview, text_length, created_at,
             translated_text, notes, is_modified
      FROM segments
      WHERE project_id = ? AND chapter_id = ?
      ORDER BY position ASC
    `)

    try {
      const rows = stmt.all(projectId, chapterId)

      return rows.map(row => ({
        id: row.id,
        projectId: row.project_id,
        chapterId: row.chapter_id,
        chapterHref: row.chapter_href,
        xpath: row.xpath,
        endXPath: row.end_xpath,
        cfiRanges: this.parseCfiArray(row.cfi_range),
        position: row.position,
        isEmpty: row.is_empty === 1,
        parentSegmentId: row.parent_segment_id,
        preview: row.preview,
        textLength: row.text_length,
        createdAt: row.created_at,
        translatedText: row.translated_text,
        notes: row.notes ? JSON.parse(row.notes) : null,
        isModified: row.is_modified === 1
      }))
    } catch (error) {
      console.error('加载分段失败:', error)
      return []
    }
  }

  /**
   * 获取已经保存分段的章节列表
   */
  getChaptersWithSegments(projectId) {
    const stmt = this.db.prepare(`
      SELECT DISTINCT chapter_id AS chapterId, chapter_href AS chapterHref
      FROM segments
      WHERE project_id = ?
    `)

    try {
      return stmt.all(projectId)
    } catch (error) {
      console.error('查询已保存章节列表失败:', error)
      return []
    }
  }

  /**
   * 更新分段的译文和附注
   * @param {string} segmentId - 分段ID
   * @param {string|null} translatedText - 译文
   * @param {Array|null} notes - 附注列表
   */
  updateSegmentNotes(segmentId, translatedText, notes) {
    const stmt = this.db.prepare(`
      UPDATE segments
      SET translated_text = ?,
          notes = ?,
          is_modified = 1
      WHERE id = ?
    `)

    try {
      const notesJSON = notes ? JSON.stringify(notes) : null
      stmt.run(translatedText || null, notesJSON, segmentId)
      console.log('分段译文和附注更新成功:', segmentId)
      return true
    } catch (error) {
      console.error('更新分段译文和附注失败:', error)
      throw error
    }
  }

  /**
   * 删除单个分段
   * @param {string} segmentId - 分段ID
   */
  deleteSegment(segmentId) {
    const stmt = this.db.prepare(`
      DELETE FROM segments WHERE id = ?
    `)

    try {
      const result = stmt.run(segmentId)
      console.log('分段删除成功:', segmentId, '影响行数:', result.changes)
      return result.changes > 0
    } catch (error) {
      console.error('删除分段失败:', error)
      throw error
    }
  }

  /**
   * 删除指定章节的所有分段
   * @param {string} projectId - 项目ID
   * @param {string} chapterId - 章节ID
   */
  deleteChapterSegments(projectId, chapterId) {
    const stmt = this.db.prepare(`
      DELETE FROM segments WHERE project_id = ? AND chapter_id = ?
    `)

    try {
      const result = stmt.run(projectId, chapterId)
      console.log('章节分段删除成功:', { projectId, chapterId, changes: result.changes })
      return result.changes
    } catch (error) {
      console.error('删除章节分段失败:', error)
      throw error
    }
  }

  /**
   * 删除项目（级联删除分段）
   */
  deleteProject(projectId) {
    try {
      // 先删除所有相关分段
      const deleteSegmentsStmt = this.db.prepare(`
        DELETE FROM segments WHERE project_id = ?
      `)
      deleteSegmentsStmt.run(projectId)
      console.log('项目相关分段删除成功:', projectId)

      // 再删除项目记录
      const deleteProjectStmt = this.db.prepare(`
        DELETE FROM projects WHERE id = ?
      `)
      deleteProjectStmt.run(projectId)
      console.log('项目删除成功:', projectId)
      return true
    } catch (error) {
      console.error('删除项目失败:', error)
      throw error
    }
  }

  /**
   * 添加书签
   * @param {string} segmentId - 分段ID
   * @returns {number|null} 书签ID，如果已存在则返回null
   */
  addBookmark(segmentId) {
    const stmt = this.db.prepare(`
      INSERT INTO bookmarks (segment_id)
      VALUES (?)
    `)

    try {
      const result = stmt.run(segmentId)
      console.log('书签添加成功:', segmentId, '书签ID:', result.lastInsertRowid)
      return result.lastInsertRowid
    } catch (error) {
      // 如果是唯一索引冲突（已存在），返回null
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE')) {
        console.log('书签已存在:', segmentId)
        return null
      }
      console.error('添加书签失败:', error)
      throw error
    }
  }

  /**
   * 删除书签
   * @param {string} segmentId - 分段ID
   * @returns {boolean} 是否删除成功
   */
  removeBookmark(segmentId) {
    const stmt = this.db.prepare(`
      DELETE FROM bookmarks WHERE segment_id = ?
    `)

    try {
      const result = stmt.run(segmentId)
      console.log('书签删除成功:', segmentId, '影响行数:', result.changes)
      return result.changes > 0
    } catch (error) {
      console.error('删除书签失败:', error)
      throw error
    }
  }

  /**
   * 获取所有书签（JOIN segments表获取完整信息）
   * @returns {Array} 书签列表
   */
  getBookmarks() {
    const stmt = this.db.prepare(`
      SELECT
        b.id as bookmark_id,
        b.created_at as bookmarked_at,
        s.*
      FROM bookmarks b
      INNER JOIN segments s ON b.segment_id = s.id
      ORDER BY s.chapter_id, s.position
    `)

    try {
      const rows = stmt.all()
      return rows.map(row => ({
        bookmarkId: row.bookmark_id,
        bookmarkedAt: row.bookmarked_at,
        segment: {
          id: row.id,
          projectId: row.project_id,
          chapterId: row.chapter_id,
          chapterHref: row.chapter_href,
          xpath: row.xpath,
          endXPath: row.end_xpath,
          cfiRanges: this.parseCfiArray(row.cfi_range),
          position: row.position,
          isEmpty: row.is_empty === 1,
          parentSegmentId: row.parent_segment_id,
          preview: row.preview,
          textLength: row.text_length,
          createdAt: row.created_at,
          translatedText: row.translated_text,
          notes: row.notes ? JSON.parse(row.notes) : null,
          isModified: row.is_modified === 1
        }
      }))
    } catch (error) {
      console.error('获取书签列表失败:', error)
      return []
    }
  }

  /**
   * 检查是否已收藏
   * @param {string} segmentId - 分段ID
   * @returns {boolean} 是否已收藏
   */
  isBookmarked(segmentId) {
    const stmt = this.db.prepare(`
      SELECT id FROM bookmarks WHERE segment_id = ?
    `)

    try {
      const result = stmt.get(segmentId)
      return !!result
    } catch (error) {
      console.error('检查书签状态失败:', error)
      return false
    }
  }

  /**
   * 合并多个段落
   * @param {string} targetId - 目标段落ID（保留的第一个段落）
   * @param {string[]} sourceIds - 源段落ID列表（将被删除的段落）
   * @param {string} endXPath - 合并后的结束XPath
   * @param {string[]} cfiRanges - 合并后的CFI列表
   * @param {number} textLength - 合并后的文本长度
   * @returns {Object} 更新后的段落数据
   */
  mergeSegments(targetId, sourceIds, endXPath, cfiRanges, textLength) {
    console.log('开始合并段落:', { targetId, sourceIds, endXPath, textLength, cfiCount: Array.isArray(cfiRanges) ? cfiRanges.length : 0 })

    // 使用事务确保原子性
    const merge = this.db.transaction(() => {
      // 1. 验证目标段落存在
      const getTargetStmt = this.db.prepare(`
        SELECT * FROM segments WHERE id = ?
      `)
      const targetSegment = getTargetStmt.get(targetId)
      if (!targetSegment) {
        throw new Error(`目标段落不存在: ${targetId}`)
      }

      // 2. 验证所有源段落存在且满足条件（无译文、无附注）
      const getSourceStmt = this.db.prepare(`
        SELECT id, translated_text, notes FROM segments WHERE id = ?
      `)
      for (const sourceId of sourceIds) {
        const sourceSegment = getSourceStmt.get(sourceId)
        if (!sourceSegment) {
          throw new Error(`源段落不存在: ${sourceId}`)
        }
        if (sourceSegment.translated_text || sourceSegment.notes) {
          throw new Error(`段落 ${sourceId} 有译文或附注，不能合并`)
        }
      }

      // 3. 删除源段落的书签（级联删除会自动处理）
      const deleteBookmarkStmt = this.db.prepare(`
        DELETE FROM bookmarks WHERE segment_id = ?
      `)
      for (const sourceId of sourceIds) {
        deleteBookmarkStmt.run(sourceId)
      }

      // 4. 更新目标段落
      const updateTargetStmt = this.db.prepare(`
        UPDATE segments
        SET end_xpath = ?,
            cfi_range = ?,
            text_length = ?
        WHERE id = ?
      `)
      const cfiJSON = JSON.stringify(Array.isArray(cfiRanges)
        ? cfiRanges.filter((cfi) => typeof cfi === 'string' && cfi.trim().length > 0)
        : [])

      updateTargetStmt.run(endXPath, cfiJSON, textLength, targetId)

      // 5. 删除源段落
      const deleteSegmentStmt = this.db.prepare(`
        DELETE FROM segments WHERE id = ?
      `)
      for (const sourceId of sourceIds) {
        deleteSegmentStmt.run(sourceId)
      }

      // 6. 获取更新后的段落数据
      const updatedSegment = getTargetStmt.get(targetId)
      return updatedSegment
    })

    try {
      const result = merge()
      console.log('段落合并成功:', targetId)

      // 转换为前端格式
      return {
        id: result.id,
        projectId: result.project_id,
        chapterId: result.chapter_id,
        chapterHref: result.chapter_href,
        xpath: result.xpath,
        endXPath: result.end_xpath,
        cfiRanges: this.parseCfiArray(result.cfi_range),
        position: result.position,
        isEmpty: result.is_empty === 1,
        parentSegmentId: result.parent_segment_id,
        preview: result.preview,
        textLength: result.text_length,
        createdAt: result.created_at,
        translatedText: result.translated_text,
        notes: result.notes ? JSON.parse(result.notes) : null,
        isModified: result.is_modified === 1
      }
    } catch (error) {
      console.error('合并段落失败:', error)
      throw error
    }
  }

  /**
   * 关闭数据库
   */
  close() {
    if (this.db) {
      this.db.close()
      console.log('数据库已关闭')
    }
  }
}

// 单例模式
const dbService = new DatabaseService()

module.exports = dbService
