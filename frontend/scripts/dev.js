import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectDir = path.resolve(frontendDir, '..')
const node = process.execPath
const frontendPort = process.env.FRONTEND_PORT || '5173'
const motoboyPort = process.env.MOTOBOY_PORT || '5174'

const servers = [
  {
    name: 'Frontend',
    cwd: frontendDir,
    script: path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js'),
    args: ['--host', '0.0.0.0', '--port', frontendPort, '--strictPort'],
  },
  {
    name: 'Motoboy',
    cwd: path.join(projectDir, 'motoboy'),
    script: path.join(projectDir, 'motoboy', 'node_modules', 'vite', 'bin', 'vite.js'),
    args: ['--host', '0.0.0.0', '--port', motoboyPort, '--strictPort'],
  },
]

const children = []
let stopping = false

function stopServers(exitCode) {
  if (stopping) return
  stopping = true
  process.exitCode = exitCode
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill()
  }
}

for (const server of servers) {
  const child = spawn(node, [server.script, ...server.args], {
    cwd: server.cwd,
    stdio: 'inherit',
  })
  children.push(child)

  child.on('error', (error) => {
    console.error(`${server.name} failed to start: ${error.message}`)
    stopServers(1)
  })

  child.on('exit', (code, signal) => {
    if (stopping) return
    if (signal) {
      console.error(`${server.name} stopped after ${signal}`)
    } else if (code !== 0) {
      console.error(`${server.name} exited with code ${code}`)
    }
    stopServers(code === 0 ? 1 : code ?? 1)
  })
}

process.on('SIGINT', () => stopServers(130))
process.on('SIGTERM', () => stopServers(143))
