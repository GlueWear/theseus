#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '..');
const runnerRoot = process.env.THESEUS_SIDECAR_RUNNER_DIR || path.join(os.tmpdir(), 'theseus-sidecar-runner');
const runnerBin = path.join(runnerRoot, 'bin', 'transport-sidecar.mjs');

function copyFile(rel) {
  const src = path.join(sourceRoot, rel);
  const dst = path.join(runnerRoot, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function ensureRunner() {
  fs.mkdirSync(runnerRoot, { recursive: true });
  copyFile('package.json');
  copyFile('package-lock.json');
  copyFile('bin/transport-sidecar.mjs');

  const nockPkg = path.join(runnerRoot, 'node_modules', '@urbit', 'nockjs', 'package.json');
  if (!fs.existsSync(nockPkg)) {
    console.error(`[transport-runner] installing npm dependencies in ${runnerRoot}`);
    const npm = spawnSync('npm', ['ci'], { cwd: runnerRoot, stdio: 'inherit' });
    if (npm.status !== 0) process.exit(npm.status ?? 1);
  }
}

ensureRunner();

const child = spawn(process.execPath, [runnerBin, ...process.argv.slice(2)], {
  cwd: runnerRoot,
  stdio: 'inherit',
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
