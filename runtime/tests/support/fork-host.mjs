import { spawn } from 'node:child_process'

spawn('bash', ['-c', 'while :; do sleep 30 & sleep 0.001; done'], { stdio: 'ignore' })
setTimeout(() => process.exit(3), 300)
