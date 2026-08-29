import fs from 'fs'
import path from 'path'

import { getConfigDir } from './auth'
import { logger } from './logger'

const MAX_RECENT_PROJECTS = 10

export interface RecentProject {
  path: string
  lastOpened: number
}

export const getRecentProjectsPath = (): string => {
  return path.join(getConfigDir(), 'recent-projects.json')
}

export const loadRecentProjects = (): RecentProject[] => {
  const recentProjectsPath = getRecentProjectsPath()

  if (!fs.existsSync(recentProjectsPath)) {
    return []
  }

  try {
    const fileContent = fs.readFileSync(recentProjectsPath, 'utf8')
    const parsed = JSON.parse(fileContent)

    if (!Array.isArray(parsed)) {
      return []
    }

    const validProjects = parsed.filter(
      (item): item is RecentProject =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.path === 'string' &&
        typeof item.lastOpened === 'number',
    )

    const existingProjects = validProjects.filter((project) => {
      try {
        return fs.existsSync(project.path)
      } catch {
        return false
      }
    })

    return existingProjects.sort((a, b) => b.lastOpened - a.lastOpened)
  } catch (error) {
    logger.debug(
      { error: error instanceof Error ? error.message : String(error) },
      'Error reading recent projects',
    )
    return []
  }
}

export const clearRecentProjects = (): void => {
  const recentProjectsPath = getRecentProjectsPath()

  try {
    if (fs.existsSync(recentProjectsPath)) {
      fs.writeFileSync(recentProjectsPath, JSON.stringify([], null, 2))
    }
  } catch (error) {
    logger.debug(
      { error: error instanceof Error ? error.message : String(error) },
      'Error clearing recent projects',
    )
  }
}

export const removeRecentProject = (projectPath: string): void => {
  const recentProjectsPath = getRecentProjectsPath()

  try {
    const existingProjects = loadRecentProjects()
    const filteredProjects = existingProjects.filter(
      (p) => p.path !== projectPath,
    )

    fs.writeFileSync(
      recentProjectsPath,
      JSON.stringify(filteredProjects, null, 2),
    )
  } catch (error) {
    logger.debug(
      { error: error instanceof Error ? error.message : String(error) },
      'Error removing recent project',
    )
  }
}

export const saveRecentProject = (projectPath: string): void => {
  if (!fs.existsSync(projectPath)) {
    logger.debug({ projectPath }, 'Skipping save for non-existent project path')
    return
  }

  const configDir = getConfigDir()
  const recentProjectsPath = getRecentProjectsPath()

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    const existingProjects = loadRecentProjects()

    const filteredProjects = existingProjects.filter(
      (p) => p.path !== projectPath,
    )

    const updatedProjects: RecentProject[] = [
      { path: projectPath, lastOpened: Date.now() },
      ...filteredProjects,
    ].slice(0, MAX_RECENT_PROJECTS)

    fs.writeFileSync(
      recentProjectsPath,
      JSON.stringify(updatedProjects, null, 2),
    )
  } catch (error) {
    logger.debug(
      { error: error instanceof Error ? error.message : String(error) },
      'Error saving recent project',
    )
  }
}
