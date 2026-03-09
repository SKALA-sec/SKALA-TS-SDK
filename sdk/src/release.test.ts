/// <reference path="../bun-test.d.ts" />
/// <reference types="node" />

import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('sdk release assets', () => {
  it('defines npm publish metadata', () => {
    const currentDir = dirname(fileURLToPath(import.meta.url))
    const packageJson = JSON.parse(
      readFileSync(resolve(currentDir, '..', 'package.json'), 'utf8')
    ) as Record<string, unknown>

    expect(packageJson.publishConfig).toEqual({ access: 'public' })
    expect(packageJson).toHaveProperty('repository')
    expect(packageJson).toHaveProperty('license')
    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/SKALA-sec/SKALA-TS-SDK.git',
      directory: 'sdk',
    })
    expect(packageJson.homepage).toBe('https://github.com/SKALA-sec/SKALA-TS-SDK')
    expect(packageJson.bugs).toEqual({
      url: 'https://github.com/SKALA-sec/SKALA-TS-SDK/issues',
    })
  })

  it('packs the built dist artifacts for npm release', () => {
    const currentDir = dirname(fileURLToPath(import.meta.url))
    const sdkDir = resolve(currentDir, '..')
    const packDir = mkdtempSync(join(tmpdir(), 'skala-pack-'))
    const pack = spawnSync(
      'bash',
      [
        '-lc',
        `rm -rf dist && tsc -p tsconfig.json && npm_config_cache=/tmp/skala-npm-cache npm pack --pack-destination ${JSON.stringify(
          packDir
        )} >/dev/null && tar -tf ${JSON.stringify(join(packDir, 'skala-node-0.2.0.tgz'))}`,
      ],
      {
        cwd: sdkDir,
        encoding: 'utf8',
      }
    )

    expect(pack.status).toBe(0)
    const files = pack.stdout
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith('package/'))

    rmSync(packDir, { recursive: true, force: true })

    expect(files).toContain('package/dist/client.js')
    expect(files).toContain('package/dist/index.js')
    expect(files).toContain('package/dist/types.d.ts')
    expect(files).not.toContain('package/dist/client.test.js')
  }, 45_000)
})
