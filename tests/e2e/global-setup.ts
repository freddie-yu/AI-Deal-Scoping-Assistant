import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

// Own a direct Node child so Windows teardown does not depend on taskkill /T.
export default async function setup() {
  const url = 'http://127.0.0.1:3001/api/health';
  const probe = () => fetch(url, { signal: AbortSignal.timeout(500) }).then(r => r.ok).catch(() => false);
  if (await probe()) throw new Error('Port 3001 is already in use. Stop the local server before browser tests.');
  const child = spawn(process.execPath, ['dist/server/server/main.js'], { env: { ...process.env, DATA_DIR: '.data/smoke' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let failure = ''; child.stderr.on('data', data => { failure += String(data); }); child.stdout.resume();
  const exited = once(child, 'exit');
  async function stop() { if (child.exitCode === null && child.signalCode === null) child.kill(); await exited; }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await probe()) return stop;
    if (child.exitCode !== null) throw new Error(`Test server stopped: ${failure}`);
    await delay(100);
  }
  await stop(); throw new Error(`Test server did not become ready: ${failure}`);
}
