const { spawn } = require('node:child_process');
const http = require('node:http');
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

function waitForApi(attempts = 40) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      const request = http.get('http://localhost:3001/api/health', (response) => {
        response.resume();
        if (response.statusCode === 200) {
          resolve();
          return;
        }
        retry(remaining);
      });

      request.on('error', () => retry(remaining));
      request.setTimeout(1000, () => request.destroy());
    };

    const retry = (remaining) => {
      if (remaining <= 1) {
        reject(new Error("Le serveur API n'a pas démarré"));
        return;
      }
      setTimeout(() => check(remaining - 1), 250);
    };

    check(attempts);
  });
}

waitForApi()
  .then(() => start('vite', path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')))
  .catch((error) => {
    console.error(`[dev] ${error.message}`);
    shutdown(1);
  });
