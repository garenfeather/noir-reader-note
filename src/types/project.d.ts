/**
 * 项目相关类型定义
 */

export interface Project {
  id: string                    // 项目ID (epub-name-timestamp)
  epubName: string              // EPUB文件名
  epubPath: string              // 原始EPUB文件路径
  projectPath: string           // 项目目录路径
  createdAt: string             // 创建时间
  updatedAt: string             // 更新时间
  metadata?: EpubMetadata       // EPUB元信息
}

export interface EpubMetadata {
  title?: string
  author?: string
  publisher?: string
  language?: string
  [key: string]: any
}

export interface ProjectCreateOptions {
  epubPath: string              // EPUB文件路径
  epubData: ArrayBuffer         // EPUB文件数据
}

export interface ProjectInfo {
  project: Project
  extractedPath: string         // 解压后的内容路径
  originalEpubPath: string      // 复制的原始EPUB路径
}
