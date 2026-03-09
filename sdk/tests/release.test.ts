/// <reference path="../bun-test.d.ts" />
/// <reference types="node" />

import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SDK_DIR = resolve(import.meta.dir, '..')

describe('release', () => {
  it('has correct package metadata', () => {
    const pkg = JSON.parse(
      readFileSync(join(SDK_DIR, 'package.json'), 'utf8')
    ) as Record<string, unknown>

    expect(pkg.name).toBe('@skala/node')
    expect(pkg.publishConfig).toEqual({ access: 'public' })
    expect(pkg).toHaveProperty('repository')
    expect(pkg).toHaveProperty('license')
    expect(pkg.homepage).toBe('https://github.com/SKALA-sec/SKALA-TS-SDK')
  })

  it('packs only dist/ and README.md', () => {
    const packDir = mkdtempSync(join(tmpdir(), 'skala-pack-'))
    const pack = spawnSync(
      'bash',
      [
        '-lc',
        `rm -rf dist && tsc -p tsconfig.json && npm_config_cache=/tmp/skala-npm-cache npm pack --pack-destination ${JSON.stringify(
          packDir
        )} >/dev/null && tar -tf ${JSON.stringify(join(packDir, 'skala-node-0.2.0.tgz'))}`,
      ],
      { cwd: SDK_DIR, encoding: 'utf8' }
    )

    expect(pack.status).toBe(0)
    const files = pack.stdout
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.startsWith('package/'))

    rmSync(packDir, { recursive: true, force: true })

    expect(files).toContain('package/dist/client.js')
    expect(files).toContain('package/dist/index.js')
    expect(files).toContain('package/dist/types.d.ts')
    expect(files).toContain('package/README.md')
    expect(files).not.toContain('package/dist/client.test.js')
  }, 45_000)
})
