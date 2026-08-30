import fs from 'fs'
import path from 'path'

export interface ProjectSettingsData {
  model?: string
  agentMode?: string
  theme?: string
  version?: string
}

export interface ProjectKeysData {
  groq_api_key?: string
  openrouter_api_key?: string
  deepseek_api_key?: string
}

export interface ProjectContextData {
  workName: string
  projectPath: string
  createdAt: string
  lastActive: string
  sessionCount: number
  lastModel?: string
  lastAgentMode?: string
}

export interface WorkspaceInitResult {
  isReturningWork: boolean
  context: ProjectContextData
  settings: ProjectSettingsData
}

export function getProjectRivocodeDir(projectRoot: string): string {
  return path.join(projectRoot, '.rivocode')
}

export function initProjectWorkspace(projectRoot: string): WorkspaceInitResult {
  const rivoDir = getProjectRivocodeDir(projectRoot)
  const contextFile = path.join(rivoDir, 'context.json')
  const settingsFile = path.join(rivoDir, 'settings.json')
  const keysFile = path.join(rivoDir, 'keys.json')

  const isReturningWork = fs.existsSync(contextFile)

  if (!fs.existsSync(rivoDir)) {
    fs.mkdirSync(rivoDir, { recursive: true })
  }

  // 1. Context File
  let context: ProjectContextData
  const workName = path.basename(projectRoot) || 'workspace'

  if (isReturningWork) {
    try {
      const raw = fs.readFileSync(contextFile, 'utf8')
      const parsed = JSON.parse(raw) as Partial<ProjectContextData>
      context = {
        workName: parsed.workName || workName,
        projectPath: projectRoot,
        createdAt: parsed.createdAt || new Date().toISOString(),
        lastActive: parsed.lastActive || new Date().toISOString(),
        sessionCount: (parsed.sessionCount || 1) + 1,
        lastModel: parsed.lastModel || 'deepseek',
        lastAgentMode: parsed.lastAgentMode || 'DEFAULT',
      }
    } catch {
      context = {
        workName,
        projectPath: projectRoot,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        sessionCount: 1,
        lastModel: 'deepseek',
        lastAgentMode: 'DEFAULT',
      }
    }
  } else {
    context = {
      workName,
      projectPath: projectRoot,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      sessionCount: 1,
      lastModel: 'deepseek',
      lastAgentMode: 'DEFAULT',
    }
  }

  fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf8')

  // 2. Settings File
  let settings: ProjectSettingsData = {
    model: 'deepseek',
    agentMode: 'DEFAULT',
    theme: 'dark',
    version: '1.0.0',
  }

  if (fs.existsSync(settingsFile)) {
    try {
      const raw = fs.readFileSync(settingsFile, 'utf8')
      settings = { ...settings, ...JSON.parse(raw) }
    } catch {
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8')
    }
  } else {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8')
  }

  // 3. Keys File (Template or linked keys)
  if (!fs.existsSync(keysFile)) {
    const keysTemplate: ProjectKeysData = {
      groq_api_key: process.env.GROQ_API_KEY || '',
      openrouter_api_key: process.env.OPENROUTER_API_KEY || '',
      deepseek_api_key: process.env.DEEPSEEK_API_KEY || '',
    }
    fs.writeFileSync(keysFile, JSON.stringify(keysTemplate, null, 2), 'utf8')
  }

  return {
    isReturningWork,
    context,
    settings,
  }
}

export function updateProjectContext(
  projectRoot: string,
  updates: Partial<ProjectContextData>,
): void {
  try {
    const rivoDir = getProjectRivocodeDir(projectRoot)
    const contextFile = path.join(rivoDir, 'context.json')
    if (fs.existsSync(contextFile)) {
      const raw = fs.readFileSync(contextFile, 'utf8')
      const current = JSON.parse(raw) as ProjectContextData
      const updated = {
        ...current,
        ...updates,
        lastActive: new Date().toISOString(),
      }
      fs.writeFileSync(contextFile, JSON.stringify(updated, null, 2), 'utf8')
    }
  } catch {
    // Ignore context update error
  }
}
