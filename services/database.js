/**
 * 数据库服务 - SQLite数据库操作
 * 在Electron主进程中运行
 */

const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

class DatabaseService {
  constructor() {
    this.db = null
    this.dbPath = null
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
    // 分段文本通过xpath从XHTML动态读取，不存储在数据库中
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS segments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        chapter_href TEXT NOT NULL,
        xpath TEXT NOT NULL,
        cfi_range TEXT,
        position INTEGER NOT NULL,
        is_empty BOOLEAN DEFAULT 0,
        parent_segment_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

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
   * 分段文本通过xpath从XHTML动态读取，不存储在数据库中
   */
  saveSegments(projectId, segments) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO segments
      (id, project_id, chapter_id, chapter_href, xpath, cfi_range, position, is_empty, parent_segment_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // 使用事务确保数据一致性
    const transaction = this.db.transaction((segments) => {
      for (const segment of segments) {
        stmt.run(
          segment.id,
          projectId,
          segment.chapterId,
          segment.chapterHref,
          segment.xpath,
          segment.cfiRange || null,
          segment.position,
          segment.isEmpty ? 1 : 0,
          segment.parentSegmentId || null
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
   * 加载章节的分段数据
   * 分段文本通过xpath从XHTML动态读取，不从数据库返回
   */
  loadSegments(projectId, chapterId) {
    const stmt = this.db.prepare(`
      SELECT * FROM segments
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
        cfiRange: row.cfi_range,
        position: row.position,
        isEmpty: row.is_empty === 1,
        parentSegmentId: row.parent_segment_id,
        createdAt: row.created_at
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
