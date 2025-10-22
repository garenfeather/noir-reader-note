/**
 * 项目状态管理
 */

import { create } from 'zustand'
import { Project, ProjectInfo } from '../types/project'

interface ProjectState {
  // 当前项目信息
  currentProject: Project | null
  projectInfo: ProjectInfo | null

  // 是否有未保存的修改
  hasUnsavedChanges: boolean

  // Actions
  setCurrentProject: (projectInfo: ProjectInfo | null) => void
  setHasUnsavedChanges: (has: boolean) => void
  clearProject: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  projectInfo: null,
  hasUnsavedChanges: false,

  setCurrentProject: (projectInfo) =>
    set({
      currentProject: projectInfo?.project || null,
      projectInfo: projectInfo
    }),

  setHasUnsavedChanges: (has) =>
    set({ hasUnsavedChanges: has }),

  clearProject: () =>
    set({
      currentProject: null,
      projectInfo: null,
      hasUnsavedChanges: false
    })
}))
