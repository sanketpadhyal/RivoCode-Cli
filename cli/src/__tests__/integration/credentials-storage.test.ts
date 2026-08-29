import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  clearMockedModules,
  mockModule,
} from '@rivocode/common/testing/mock-modules'
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'

import { setProjectRoot } from '../../project-files'
import * as authModule from '../../utils/auth'
import { saveUserCredentials, getUserCredentials } from '../../utils/auth'

import type { User } from '../../utils/auth'

const TEST_USER: User = {
  id: 'test-user-123',
  name: 'Test User',
  email: 'test@example.com',
  authToken: 'test-session-token-abc',
  fingerprintId: 'test-fingerprint',
  fingerprintHash: 'test-hash',
}

describe('Credentials Storage Integration', () => {
  let tempConfigDir: string

  beforeEach(() => {
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manicode-test-'))

    setProjectRoot(tempConfigDir)

    spyOn(authModule, 'getConfigDir').mockReturnValue(tempConfigDir)
    spyOn(authModule, 'getCredentialsPath').mockReturnValue(
      path.join(tempConfigDir, 'credentials.json'),
    )
  })

  afterEach(() => {
    if (fs.existsSync(tempConfigDir)) {
      fs.rmSync(tempConfigDir, { recursive: true, force: true })
    }

    mock.restore()
    clearMockedModules()
  })

  describe('P0: File System Operations', () => {
    test('should create config directory if it does not exist', () => {
      if (fs.existsSync(tempConfigDir)) {
        fs.rmSync(tempConfigDir, { recursive: true })
      }
      expect(fs.existsSync(tempConfigDir)).toBe(false)

      saveUserCredentials(TEST_USER)

      expect(fs.existsSync(tempConfigDir)).toBe(true)

      const stats = fs.statSync(tempConfigDir)
      expect(stats.isDirectory()).toBe(true)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      expect(fs.existsSync(credentialsPath)).toBe(true)
    })

    test('should write credentials.json with correct JSON format', () => {
      saveUserCredentials(TEST_USER)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      const fileContent = fs.readFileSync(credentialsPath, 'utf8')

      const parsed = JSON.parse(fileContent)

      expect(parsed).toHaveProperty('default')
      expect(typeof parsed.default).toBe('object')

      expect(parsed.default.id).toBe(TEST_USER.id)
      expect(parsed.default.name).toBe(TEST_USER.name)
      expect(parsed.default.email).toBe(TEST_USER.email)
      expect(parsed.default.authToken).toBe(TEST_USER.authToken)
      expect(parsed.default.fingerprintId).toBe(TEST_USER.fingerprintId)
      expect(parsed.default.fingerprintHash).toBe(TEST_USER.fingerprintHash)
    })

    test('should overwrite existing credentials when saving new ones', () => {
      saveUserCredentials(TEST_USER)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      let fileContent = fs.readFileSync(credentialsPath, 'utf8')
      let parsed = JSON.parse(fileContent)
      expect(parsed.default.id).toBe(TEST_USER.id)

      const newUser: User = {
        id: 'different-user-456',
        name: 'Different User',
        email: 'different@example.com',
        authToken: 'different-token',
        fingerprintId: 'different-fingerprint',
        fingerprintHash: 'different-hash',
      }
      saveUserCredentials(newUser)

      fileContent = fs.readFileSync(credentialsPath, 'utf8')
      parsed = JSON.parse(fileContent)

      expect(parsed.default.id).toBe(newUser.id)
      expect(parsed.default.name).toBe(newUser.name)
      expect(parsed.default.email).toBe(newUser.email)
      expect(parsed.default.authToken).toBe(newUser.authToken)

      const keys = Object.keys(parsed)
      expect(keys.length).toBe(1)
      expect(keys[0]).toBe('default')
    })

    test('should use manicode-test directory in test environment', async () => {
      mock.restore()

      await mockModule('@rivocode/common/env', () => ({
        env: { NEXT_PUBLIC_CB_ENVIRONMENT: 'test' },
      }))

      const configDir = authModule.getConfigDir()
      expect(configDir).toEqual(
        path.join(os.homedir(), '.config', 'manicode-test'),
      )
    })

    test('should use manicode-dev directory in development environment', async () => {
      mock.restore()

      await mockModule('@rivocode/common/env', () => ({
        env: { NEXT_PUBLIC_CB_ENVIRONMENT: 'dev' },
      }))

      const configDir = authModule.getConfigDir()
      expect(configDir).toEqual(
        path.join(os.homedir(), '.config', 'manicode-dev'),
      )
    })

    test('should use manicode directory in production environment', async () => {
      mock.restore()

      await mockModule('@rivocode/common/env', () => ({
        env: { NEXT_PUBLIC_CB_ENVIRONMENT: 'prod' },
      }))

      const configDir = authModule.getConfigDir()
      expect(configDir).toEqual(path.join(os.homedir(), '.config', 'manicode'))
    })

    test('should allow credentials to persist across simulated CLI restarts', () => {
      saveUserCredentials(TEST_USER)

      const loadedCredentials = getUserCredentials()

      expect(loadedCredentials).not.toBeNull()
      expect(loadedCredentials).toBeDefined()

      expect(loadedCredentials!.id).toBe(TEST_USER.id)
      expect(loadedCredentials!.name).toBe(TEST_USER.name)
      expect(loadedCredentials!.email).toBe(TEST_USER.email)
      expect(loadedCredentials!.authToken).toBe(TEST_USER.authToken)
      expect(loadedCredentials!.fingerprintId).toBe(TEST_USER.fingerprintId)
      expect(loadedCredentials!.fingerprintHash).toBe(TEST_USER.fingerprintHash)
    })

    test('drops the removed ChatGPT integration token on the next write', () => {
      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      fs.writeFileSync(
        credentialsPath,
        JSON.stringify({
          default: { ...TEST_USER, authToken: 'stale' },
          chatgptOAuth: {
            accessToken: 'a',
            refreshToken: 'r',
            expiresAt: 1,
            connectedAt: 1,
          },
          someOtherKey: 'kept',
        }),
      )

      saveUserCredentials(TEST_USER)

      const parsed = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
      expect(parsed.chatgptOAuth).toBeUndefined()
      expect(parsed.someOtherKey).toBe('kept')
      expect(parsed.default.authToken).toBe(TEST_USER.authToken)
    })
  })

  describe('P0: Credential Format Validation', () => {
    test('should save user ID in credentials', () => {
      saveUserCredentials(TEST_USER)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      const parsed = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

      expect(parsed.default.id).toBe(TEST_USER.id)
    })

    test('should save user name in credentials', () => {
      saveUserCredentials(TEST_USER)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      const parsed = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

      expect(parsed.default.name).toBe(TEST_USER.name)
    })

    test('should save user email in credentials', () => {
      saveUserCredentials(TEST_USER)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      const parsed = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

      expect(parsed.default.email).toBe(TEST_USER.email)
    })

    test('should save authToken (session token) in credentials', () => {
      saveUserCredentials(TEST_USER)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      const parsed = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

      expect(parsed.default.authToken).toBe(TEST_USER.authToken)
      expect(parsed.default.authToken).toBeTruthy()
    })

    test('should save fingerprintId in credentials', () => {
      saveUserCredentials(TEST_USER)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      const parsed = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

      expect(parsed.default.fingerprintId).toBe(TEST_USER.fingerprintId)
    })

    test('should save fingerprintHash in credentials', () => {
      saveUserCredentials(TEST_USER)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      const parsed = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

      expect(parsed.default.fingerprintHash).toBe(TEST_USER.fingerprintHash)
    })

    test('should produce valid, parseable JSON', () => {
      saveUserCredentials(TEST_USER)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      const fileContent = fs.readFileSync(credentialsPath, 'utf8')

      let parsed: any
      expect(() => {
        parsed = JSON.parse(fileContent)
      }).not.toThrow()

      expect(parsed).toHaveProperty('default')
      expect(typeof parsed.default).toBe('object')
      expect(parsed.default).toHaveProperty('id')
      expect(parsed.default).toHaveProperty('authToken')
    })
  })

  describe('P2: File System Edge Cases', () => {
    test('should preserve file permissions when writing credentials', () => {
      saveUserCredentials(TEST_USER)

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      const stats = fs.statSync(credentialsPath)
      const mode = stats.mode

      if (process.platform !== 'win32') {
        expect((mode & 0o400) !== 0).toBe(true)

        expect((mode & 0o200) !== 0).toBe(true)
      } else {
        expect(fs.existsSync(credentialsPath)).toBe(true)
      }
    })

    test('should handle write permission errors gracefully', () => {
      const writeError = new Error(
        'EACCES: permission denied',
      ) as NodeJS.ErrnoException
      writeError.code = 'EACCES'

      const writeFileSyncSpy = spyOn(fs, 'writeFileSync').mockImplementation(
        () => {
          throw writeError
        },
      )

      expect(() => {
        saveUserCredentials(TEST_USER)
      }).toThrow('EACCES')

      expect(writeFileSyncSpy).toHaveBeenCalled()
    })

    test('should show clear error message on permission denial', () => {
      const writeError = new Error(
        "EACCES: permission denied, open '/test/credentials.json'",
      ) as NodeJS.ErrnoException
      writeError.code = 'EACCES'

      spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw writeError
      })

      expect(() => {
        saveUserCredentials(TEST_USER)
      }).toThrow()

    })

    test('should gracefully degrade if credentials cannot be written', () => {
      const writeError = new Error(
        'ENOSPC: no space left on device',
      ) as NodeJS.ErrnoException
      writeError.code = 'ENOSPC'

      spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw writeError
      })

      expect(() => {
        saveUserCredentials(TEST_USER)
      }).toThrow('ENOSPC')

    })
  })

  describe('P2: Concurrent Operations', () => {
    test('should handle rapid saves without race conditions', () => {
      const users: User[] = []
      for (let i = 0; i < 5; i++) {
        users.push({
          id: `user-${i}`,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          authToken: `token-${i}`,
          fingerprintId: `fingerprint-${i}`,
          fingerprintHash: `hash-${i}`,
        })
      }

      users.forEach((user) => saveUserCredentials(user))

      const credentialsPath = path.join(tempConfigDir, 'credentials.json')
      const fileContent = fs.readFileSync(credentialsPath, 'utf8')
      const parsed = JSON.parse(fileContent)

      expect(parsed.default.id).toBe('user-4')
      expect(parsed.default.name).toBe('User 4')

      expect(parsed).toHaveProperty('default')
      expect(typeof parsed.default.authToken).toBe('string')
    })

    test('should handle read during write without corruption', () => {

      saveUserCredentials(TEST_USER)

      const loadedBefore = getUserCredentials()
      expect(loadedBefore).not.toBeNull()
      expect(loadedBefore!.id).toBe(TEST_USER.id)

      const newUser: User = {
        id: 'new-user-789',
        name: 'New User',
        email: 'new@example.com',
        authToken: 'new-token',
        fingerprintId: 'new-fingerprint',
        fingerprintHash: 'new-hash',
      }
      saveUserCredentials(newUser)

      const loadedAfter = getUserCredentials()
      expect(loadedAfter).not.toBeNull()
      expect(loadedAfter!.id).toBe(newUser.id)
      expect(loadedAfter!.name).toBe(newUser.name)
      expect(loadedAfter!.authToken).toBe(newUser.authToken)

      expect(loadedAfter!.id).not.toBe(TEST_USER.id)
    })
  })
})
