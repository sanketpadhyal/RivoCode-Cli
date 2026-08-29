#!/usr/bin/env node

const { execSync } = require('child_process')

const args = process.argv.slice(2)
const versionType = args[0] || 'patch'

function log(message: string) {
  console.log(`${message}`)
}

function error(message: string) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

function formatTimestamp() {
  const now = new Date()
  const options = {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  } as const
  return now.toLocaleDateString('en-US', options)
}

function checkGitHubToken() {
  const token = process.env.CODEBUFF_GITHUB_TOKEN
  if (!token) {
    error(
      'CODEBUFF_GITHUB_TOKEN environment variable is required but not set.\n' +
      'Please set it with your GitHub personal access token or use the infisical setup.'
    )
  }

  process.env.GITHUB_TOKEN = token
  return token
}

async function triggerWorkflow(versionType: string) {
  if (!process.env.GITHUB_TOKEN) {
    error('GITHUB_TOKEN environment variable is required but not set')
  }

  try {
    const triggerCmd = `curl -s -w "HTTP Status: %{http_code}" -X POST \
      -H "Accept: application/vnd.github.v3+json" \
      -H "Authorization: token ${process.env.GITHUB_TOKEN}" \
      -H "Content-Type: application/json" \
      https://api.github.com/repos/CodebuffAI/freebuff-private/actions/workflows/cli-release-prod.yml/dispatches \
      -d '{"ref":"main","inputs":{"version_type":"${versionType}"}}'`

    const response = execSync(triggerCmd, { encoding: 'utf8' })

    if (response.includes('workflow_dispatch')) {
      log(`⚠️  Workflow dispatch failed: ${response}`)
      log('The workflow may need to be updated on GitHub. Continuing anyway...')
      log(
        'Please manually trigger the workflow at: https://github.com/CodebuffAI/freebuff-private/actions/workflows/cli-release-prod.yml',
      )
    } else {
      log('🎉 Release workflow triggered!')
    }
  } catch (err: any) {
    log(`⚠️  Failed to trigger workflow automatically: ${err.message}`)
    log(
      'You may need to trigger it manually at: https://github.com/CodebuffAI/freebuff-private/actions/workflows/cli-release-prod.yml',
    )
  }
}

async function main() {
  log('🚀 Initiating release...')
  log(`Date: ${formatTimestamp()}`)

  checkGitHubToken()
  log('✅ Using local CODEBUFF_GITHUB_TOKEN')

  log(`Version bump type: ${versionType}`)

  await triggerWorkflow(versionType)

  log('')
  log('Monitor progress at: https://github.com/CodebuffAI/freebuff-private/actions')
}

main().catch((err) => {
  error(`Release failed: ${err.message}`)
})
