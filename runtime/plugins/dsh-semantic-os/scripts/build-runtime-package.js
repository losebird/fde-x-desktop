import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { runtimeKey } from '../runtime-bundle.js'
import { finalizeRuntime } from './finalize-runtime-package.js'

const target = process.argv[2] || runtimeKey()
if (target !== runtimeKey()) throw new Error(`runtime packages must be built on their native target; runner=${runtimeKey()} target=${target}`)
const [platform, arch] = target.split('-')
const root = join(process.cwd(), 'runtime-dist', target)
rmSync(join(root, '.uv-cache'), { recursive: true, force: true })
rmSync(join(process.cwd(), 'runtime-dist', '.uv-cache'), { recursive: true, force: true })
const wheelhouse = join(root, 'wheelhouse')
mkdirSync(wheelhouse, { recursive: true })
const requirements = join(process.cwd(), 'runtime', 'requirements.txt')
const constraints = join(process.cwd(), 'runtime', 'constraints.txt')
if (!process.env.DSH_RUNTIME_PYTHON) throw new Error('DSH_RUNTIME_PYTHON must point to a relocatable Python executable staged inside runtime-dist/<target>')
const python = resolve(process.env.DSH_RUNTIME_PYTHON)
const pythonRel = relative(root, python)
if (pythonRel.startsWith('..')) throw new Error('DSH_RUNTIME_PYTHON must be inside the runtime package root')
execFileSync(process.execPath, [join(process.cwd(), 'scripts', 'download-wheelhouse.js'), python, wheelhouse, requirements, constraints], { stdio: 'inherit', env: process.env })
execFileSync(python, ['-m', 'pip', 'install', '--break-system-packages', '--no-index', '--find-links', wheelhouse, '--constraint', constraints, '--requirement', requirements], { stdio: 'inherit' })
const result = finalizeRuntime({ root, python, platform, arch, requirements, constraints })
console.log(JSON.stringify({ root, ...result }))
