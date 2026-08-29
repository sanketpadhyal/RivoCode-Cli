import { describe, test, expect } from 'bun:test'

import { isSensitiveFile } from '../../utils/create-run-config'

describe('isSensitiveFile', () => {
  test.each([
    ['.env', true],
    ['.ENV', true],
    ['.env.local', true],
    ['.env/./', true],
    ['.env ', true],
    ['.env:$DATA', true],
    ['config\\.Env.Production', true],
    ['config/.env.production', true],

    ['.env.example', false],
    ['.ENV.EXAMPLE', false],
    ['.env.sample', false],
    ['.env.template', false],

    ['private.pem', true],
    ['server.key', true],
    ['cert.p12', true],
    ['app.keystore', true],
    ['server.crt', true],

    ['.htpasswd', true],
    ['.netrc', true],
    ['credentials', true],
    ['.npmrc', true],
    ['.yarnrc.yml', true],
    ['auth.json', true],
    ['terraform.tfvars', true],

    ['id_rsa', true],
    ['id_ed25519', true],
    ['id_rsa_github', true],
    ['id_rsa.pub', false],

    ['aws_credentials', true],
    ['db_credentials', true],

    ['kubeconfig', true],
    ['my-kubeconfig.yaml', true],
    ['terraform.tfstate', true],
    ['prod.tfstate.backup', true],

    ['package.json', false],
    ['README.md', false],
    ['src/index.ts', false],
    ['.envrc', false],
    ['credentials.ts', false],
    ['terraform.tf', false],
    ['kube-config.ts', false],
  ])('%s → %s', (file, expected) => {
    expect(isSensitiveFile(file)).toBe(expected)
  })
})
