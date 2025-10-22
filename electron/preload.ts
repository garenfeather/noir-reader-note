import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  // 项目管理
  createProject: (epubPath: string, epubDataArray: number[], metadata?: any, forceCreate?: boolean) =>
    ipcRenderer.invoke('project:create', epubPath, epubDataArray, metadata, forceCreate),
  getProject: (projectId: string) =>
    ipcRenderer.invoke('project:get', projectId),
  getAllProjects: () =>
    ipcRenderer.invoke('project:getAll'),
  getProjectsFromDisk: () =>
    ipcRenderer.invoke('project:listFromDisk'),
  deleteProject: (projectId: string) =>
    ipcRenderer.invoke('project:delete', projectId),
  openProject: (projectId: string) =>
    ipcRenderer.invoke('project:open', projectId),

  // 分段管理
  saveSegments: (projectId: string, segments: any[]) =>
    ipcRenderer.invoke('segments:save', projectId, segments),
  loadSegments: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('segments:load', projectId, chapterId),
  listSegmentChapters: (projectId: string) =>
    ipcRenderer.invoke('segments:listChapters', projectId),
  parseSegments: (projectId: string, chapterId: string, chapterHref: string) =>
    ipcRenderer.invoke('segments:parse', projectId, chapterId, chapterHref),
  getSegmentText: (projectId: string, chapterHref: string, xpath: string) =>
    ipcRenderer.invoke('segments:getSegmentText', projectId, chapterHref, xpath),
})
