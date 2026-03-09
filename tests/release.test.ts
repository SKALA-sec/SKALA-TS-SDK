/// <reference path="../bun-test.d.ts" />
/// <reference types="node" />

import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SDK_DIR = resolve(import.meta.dir, '..')

interface PackageJson {
  name: string
  version: string
  publishConfig?: Record<string, unknown>
  homepage?: string
}

interface NpmPackEntry {
  filename: string
  files: Array<{ path: string }>
}

function packageTarballName(name: string, version: string): string {
  return `${name.replace('@', '').replace('/', '-')}-${version}.tgz`
}

describe('release', () => {
  it('has correct package metadata', () => {
    const pkg = JSON.parse(readFileSync(join(SDK_DIR, 'package.json'), 'utf8')) as PackageJson

    expect(pkg.name).toBe('@skalaio/node')
    expect(pkg.publishConfig).toEqual({ access: 'public' })
    expect(pkg).toHaveProperty('repository')
    expect(pkg).toHaveProperty('license')
    expect(pkg.homepage).toBe('https://github.com/SKALA-sec/SKALA-TS-SDK')
  })

  it('packs only dist/ and README.md', () => {
    const packDir = mkdtempSync(join(tmpdir(), 'skala-pack-'))

    const build = spawnSync('npm', ['run', 'build'], { cwd: SDK_DIR, encoding: 'utf8' })
    expect(build.status).toBe(0)

    const pack = spawnSync('npm', ['pack', '--json', '--pack-destination', packDir], {
      cwd: SDK_DIR,
      encoding: 'utf8',
    })

    expect(pack.status).toBe(0)

    const pkg = JSON.parse(readFileSync(join(SDK_DIR, 'package.json'), 'utf8')) as PackageJson
    const packEntries = JSON.parse(pack.stdout) as NpmPackEntry[]
    expect(packEntries).toHaveLength(1)

    const [packEntry] = packEntries
    expect(packEntry.filename).toBe(packageTarballName(pkg.name, pkg.version))

    const files = packEntry.files.map((file) => file.path)

    rmSync(packDir, { recursive: true, force: true })

    expect(files).toContain('dist/client.js')
    expect(files).toContain('dist/index.js')
    expect(files).toContain('dist/types.d.ts')
    expect(files).toContain('README.md')
    expect(files).not.toContain('dist/client.test.js')
  }, 45_000)

  it('loads the built entrypoint in Node ESM', () => {
    const build = spawnSync('npm', ['run', 'build'], { cwd: SDK_DIR, encoding: 'utf8' })
    expect(build.status).toBe(0)

    const load = spawnSync(
      'node',
      [
        '--input-type=module',
        '-e',
        "import('./dist/index.js').then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); })",
      ],
      { cwd: SDK_DIR, encoding: 'utf8' }
    )

    expect(load.status).toBe(0)
  })
})
