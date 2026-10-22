import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createReadStream, createWriteStream, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { runtimeKey } from '../runtime-bundle.js'
import { PLUGIN_VERSION } from '../version.js'

const key = process.argv[2] || runtimeKey()
const dist = join(process.cwd(), 'release-dist')
const name = `dsh-semantic-os-${PLUGIN_VERSION}-${key}`
const tarName = `${name}.tar`
const archiveName = `${tarName}.gz`
const tar = join(dist, tarName)
const archive = join(dist, archiveName)
execFileSync('tar', ['-cf', tarName, name], { cwd: dist })
await pipeline(createReadStream(tar), createGzip({ level: 9 }), createWriteStream(archive))
const hash = createHash('sha256').update(readFileSync(archive)).digest('hex')
writeFileSync(`${archive}.sha256`, `${hash}  ${archiveName}\n`)
console.log(JSON.stringify({ archive, sha256: hash }))
