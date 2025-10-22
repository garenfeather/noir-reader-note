/**
 * 缓存管理服务
 * 为每个项目管理独立的缓存数据库
 */

const Database = require('better-sqlite3')
const path = require('path')

class CacheService {
  constructor() {
    this.caches = {}  // 项目ID -> 数据库连接的映射
  }

  /**
   * 初始化项目缓存数据库
   * @param {string} projectPath - 项目路径
   * @param {string} projectId - 项目ID
   */
  initializeProjectCache(projectPath, projectId) {
    if (this.caches[projectId]) {
      return this.caches[projectId]
    }

    const cacheDbPath = path.join(projectPath, 'cache.db')

    try {
      const db = new Database(cacheDbPath)

      // 创建缓存表
      db.exec(`
        CREATE TABLE IF NOT EXISTS segment_text_cache (
          cache_key TEXT PRIMARY KEY,
          full_text TEXT NOT NULL,
          expires_at DATETIME
        )
      `)

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cache_expires
        ON segment_text_cache(expires_at)
      `)

      this.caches[projectId] = db
      console.log('项目缓存数据库初始化完成:', projectId, cacheDbPath)
      return db
    } catch (error) {
      console.error('初始化项目缓存失败:', error)
      throw error
    }
  }

  /**
   * 获取缓存的文本
   * @param {string} projectId - 项目ID
   * @param {string} chapterHref - 章节href
   * @param {string} xpath - xpath路径
   */
  getSegmentTextFromCache(projectId, chapterHref, xpath) {
    const db = this.caches[projectId]
    if (!db) {
      console.warn('缓存数据库未初始化:', projectId)
      return null
    }

    const cacheKey = `${chapterHref}:${xpath}`

    const stmt = db.prepare(`
      SELECT full_text, expires_at FROM segment_text_cache
      WHERE cache_key = ?
    `)

    try {
      const row = stmt.get(cacheKey)

      if (!row) {
        return null
      }

      // 检查是否过期（1小时）
      const expiresAt = new Date(row.expires_at)
      if (expiresAt < new Date()) {
        console.log('缓存已过期，删除:', cacheKey)
        this.deleteSegmentTextCache(projectId, cacheKey)
        return null
      }

      console.log('从缓存命中:', cacheKey)
      return row.full_text
    } catch (error) {
      console.error('查询缓存失败:', error)
      return null
    }
  }

  /**
   * 保存文本到缓存
   * @param {string} projectId - 项目ID
   * @param {string} chapterHref - 章节href
   * @param {string} xpath - xpath路径
   * @param {string} fullText - 完整文本
   */
  saveSegmentTextToCache(projectId, chapterHref, xpath, fullText) {
    const db = this.caches[projectId]
    if (!db) {
      console.warn('缓存数据库未初始化，无法保存缓存:', projectId)
      return
    }

    const cacheKey = `${chapterHref}:${xpath}`

    // 计算1小时后的过期时间
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO segment_text_cache
      (cache_key, full_text, expires_at)
      VALUES (?, ?, ?)
    `)

    try {
      stmt.run(cacheKey, fullText, expiresAt)
      console.log('文本已缓存:', cacheKey)
    } catch (error) {
      console.error('保存缓存失败:', error)
    }
  }

  /**
   * 删除单条缓存
   */
  deleteSegmentTextCache(projectId, cacheKey) {
    const db = this.caches[projectId]
    if (!db) return

    const stmt = db.prepare('DELETE FROM segment_text_cache WHERE cache_key = ?')
    try {
      stmt.run(cacheKey)
    } catch (error) {
      console.error('删除缓存失败:', error)
    }
  }

  /**
   * 清除整个项目的缓存
   * @param {string} projectId - 项目ID
   */
  clearProjectCache(projectId) {
    const db = this.caches[projectId]
    if (!db) return

    const stmt = db.prepare('DELETE FROM segment_text_cache')
    try {
      stmt.run()
      console.log('项目缓存已清除:', projectId)
    } catch (error) {
      console.error('清除缓存失败:', error)
    }
  }

  /**
   * 关闭项目缓存数据库
   * @param {string} projectId - 项目ID
   */
  closeProjectCache(projectId) {
    const db = this.caches[projectId]
    if (db) {
      db.close()
      delete this.caches[projectId]
      console.log('项目缓存数据库已关闭:', projectId)
    }
  }
}

// 单例模式
const cacheService = new CacheService()

module.exports = cacheService
