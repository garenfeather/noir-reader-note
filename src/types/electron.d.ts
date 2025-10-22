import { Project, ProjectInfo } from './project'
import { Segment, SegmentParseResult } from './segment'

export interface ElectronAPI {
  // 文件操作
  openFile: () => Promise<{ path: string; data: number[] } | null>

  // 项目管理
  createProject: (
    epubPath: string,
    epubDataArray: number[],
    metadata?: any
  ) => Promise<{ success: boolean; data?: ProjectInfo; error?: string }>

  getProject: (
    projectId: string
  ) => Promise<{ success: boolean; data?: ProjectInfo; error?: string }>

  getAllProjects: () =>
    Promise<{ success: boolean; data?: Project[]; error?: string }>

  getProjectsFromDisk: () =>
    Promise<{ success: boolean; data?: Project[]; error?: string }>

  deleteProject: (projectId: string) =>
    Promise<{ success: boolean; error?: string }>
  openProject: (
    projectId: string
  ) => Promise<{ success: boolean; data?: { projectInfo: ProjectInfo; epubData: number[] }; error?: string }>

  // 分段管理
  saveSegments: (
    projectId: string,
    segments: Segment[]
  ) => Promise<{ success: boolean; error?: string }>

  loadSegments: (
    projectId: string,
    chapterId: string
  ) => Promise<{ success: boolean; data?: Segment[]; error?: string }>

  parseSegments: (
    projectId: string,
    chapterId: string,
    chapterHref: string
  ) => Promise<{ success: boolean; data?: SegmentParseResult; error?: string }>
  getSegmentText: (
    projectId: string,
    chapterHref: string,
    xpath: string
  ) => Promise<{ success: boolean; data?: { text: string }; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
