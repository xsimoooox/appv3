const { spawn } = require('node:child_process');
const path = require('node:path');

const root = __dirname;
const children = [];

function start(label, entry, args = []) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] arrêté avec le code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
}

function shutdown(code = 0) {
  children.forEach((child) => {
    if (!child.killed) child.kill();
  });
  process.exit(code);
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

start('server', path.join(root, 'server.cjs'));
start('vite', path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'));
