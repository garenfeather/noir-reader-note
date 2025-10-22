const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  // 项目管理
  createProject: (epubPath, epubDataArray, metadata, forceCreate) =>
    ipcRenderer.invoke('project:create', epubPath, epubDataArray, metadata, forceCreate),
  getProject: (projectId) =>
    ipcRenderer.invoke('project:get', projectId),
  getAllProjects: () =>
    ipcRenderer.invoke('project:getAll'),
  getProjectsFromDisk: () =>
    ipcRenderer.invoke('project:listFromDisk'),
  deleteProject: (projectId) =>
    ipcRenderer.invoke('project:delete', projectId),
  openProject: (projectId) =>
    ipcRenderer.invoke('project:open', projectId),

  // 分段管理
  saveSegments: (projectId, segments) =>
    ipcRenderer.invoke('segments:save', projectId, segments),
  loadSegments: (projectId, chapterId) =>
    ipcRenderer.invoke('segments:load', projectId, chapterId),
  listSegmentChapters: (projectId) =>
    ipcRenderer.invoke('segments:listChapters', projectId),
  parseSegments: (projectId, chapterId, chapterHref) =>
    ipcRenderer.invoke('segments:parse', projectId, chapterId, chapterHref),
  getSegmentText: (projectId, chapterHref, xpath) =>
    ipcRenderer.invoke('segments:getSegmentText', projectId, chapterHref, xpath),
})
