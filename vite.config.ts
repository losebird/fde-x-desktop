import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { fileURLToPath, URL } from 'node:url'
import {
  FDE_ALLOWED_ORIGINS,
  FDE_RUNTIME_HOST,
  FDE_RUNTIME_PORT,
  defaultRuntimeUrl,
} from './runtime/config.mjs'

const runtimeUrl = process.env.FDE_RUNTIME_URL ?? process.env.VITE_FDE_RUNTIME_URL ?? defaultRuntimeUrl()
const runtimePort = Number(new URL(runtimeUrl).port || FDE_RUNTIME_PORT)
const devAllowedOrigins = FDE_ALLOWED_ORIGINS

function waitForPort(port: number, host: string, timeoutMs = 4000) {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ port, host })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, timeoutMs)
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.end()
      resolve(true)
    })
    socket.once('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}

function fdeRuntimePlugin(): Plugin {
  return {
    name: 'fde-x-runtime',
    async configureServer(server) {
      const host = FDE_RUNTIME_HOST
      if (process.env.FDE_SKIP_RUNTIME_SPAWN === '1') return
      if (await waitForPort(runtimePort, host, 400)) return
      const child = spawn(process.execPath, ['runtime/server.mjs'], {
        cwd: fileURLToPath(new URL('.', import.meta.url)),
        env: {
          ...process.env,
          FDE_RUNTIME_PORT: String(runtimePort),
          FDE_RUNTIME_HOST: host,
          FDE_ALLOWED_ORIGINS: devAllowedOrigins.join(','),
        },
        stdio: 'inherit',
      })
      child.on('error', (error) => {
        server.config.logger.error(`[fde-x] 无法启动本地核心：${error.message}`)
      })
      server.httpServer?.once('close', () => {
        if (!child.killed) child.kill('SIGTERM')
      })
      const ready = await waitForPort(runtimePort, host, 8000)
      if (!ready) {
        server.config.logger.warn(`[fde-x] 本地核心 ${runtimePort} 尚未就绪，AI 页会提示连接。`)
      }
    },
  }
}

const runtimeProxy = {
  '/api/v1': {
    target: runtimeUrl,
    changeOrigin: true,
  },
  '/health': {
    target: runtimeUrl,
    changeOrigin: true,
  },
  '/dsh-app': {
    target: runtimeUrl,
    changeOrigin: true,
    ws: true,
  },
  '/plugins': {
    target: runtimeUrl,
    changeOrigin: true,
  },
  '/lan-assist': {
    target: runtimeUrl,
    changeOrigin: true,
    ws: true,
  },
  '/subscriptions-auth': {
    target: runtimeUrl,
    changeOrigin: true,
  },
  '/semantic-os': {
    target: runtimeUrl,
    changeOrigin: true,
    ws: true,
  },
  '/api': {
    target: runtimeUrl,
    changeOrigin: true,
    ws: true,
  },
}

export default defineConfig({
  plugins: [react(), fdeRuntimePlugin()],
  envPrefix: ['VITE_', 'FDE_'],
  define: {
    'import.meta.env.VITE_FDE_RUNTIME_URL': JSON.stringify(runtimeUrl),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: runtimeProxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    proxy: runtimeProxy,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
})
