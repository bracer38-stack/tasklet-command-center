import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';

const DATA_DIR = path.resolve('data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const URL_FILE = path.join(DATA_DIR, 'live_tunnel_url.txt');
const STATUS_FILE = path.join(DATA_DIR, 'live_tunnel_status.json');
const CLOUDFLARED_BIN = path.resolve('bin', 'cloudflared.exe');

let currentProc = null;
let currentUrl = null;
let healthCheckTimer = null;
let failedHealthChecks = 0;

function updateStatus(provider, url, status, error = null) {
  currentUrl = url;
  if (url) {
    fs.writeFileSync(URL_FILE, url, 'utf8');
  }
  const payload = {
    provider,
    url,
    status,
    lastUpdated: new Date().toISOString(),
    error,
  };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

function startHealthChecks() {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(() => {
    if (!currentUrl) return;

    https.get(currentUrl, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        failedHealthChecks = 0;
      } else {
        failedHealthChecks++;
        console.warn(`[Tunnel Supervisor] Health check info: status ${res.statusCode}`);
      }
    }).on('error', (err) => {
      // Local DNS resolution blips on Windows home networks can happen; cloudflared handles edge retries natively.
    });
  }, 60000);
}

function startCloudflareTunnel() {
  console.log('[Tunnel Supervisor] Launching Cloudflare Tunnel...');
  updateStatus('cloudflare', null, 'starting');

  const proc = spawn(CLOUDFLARED_BIN, [
    'tunnel',
    '--url', 'http://127.0.0.1:5173',
    '--no-autoupdate',
  ]);
  currentProc = proc;

  const handleOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/([a-zA-Z0-9-]+\.trycloudflare\.com)/);
    if (match) {
      const url = match[0];
      console.log(`\n=======================================================`);
      console.log(`[Tunnel Supervisor] ACTIVE CLOUDFLARE LIVE URL: ${url}`);
      console.log(`=======================================================\n`);
      updateStatus('cloudflare', url, 'active');
      failedHealthChecks = 0;
      startHealthChecks();
    }
  };

  proc.stdout.on('data', handleOutput);
  proc.stderr.on('data', handleOutput);

  proc.on('close', (code) => {
    console.log(`[Tunnel Supervisor] Cloudflare process exited (code ${code}).`);
    updateStatus('cloudflare', null, 'disconnected');
    setTimeout(() => {
      console.log('[Tunnel Supervisor] Reconnecting Cloudflare Tunnel...');
      startCloudflareTunnel();
    }, 3000);
  });

  proc.on('error', (err) => {
    console.error('[Tunnel Supervisor] Cloudflare launch error:', err.message);
    console.log('[Tunnel Supervisor] Falling back to localhost.run SSH tunnel...');
    startLocalhostRunTunnel();
  });
}

function startLocalhostRunTunnel() {
  console.log('[Tunnel Supervisor] Launching localhost.run fallback tunnel...');
  updateStatus('localhost.run', null, 'starting');

  const proc = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=10',
    '-o', 'ServerAliveCountMax=60',
    '-R', '80:127.0.0.1:5173',
    'nokey@localhost.run',
  ]);
  currentProc = proc;

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/([a-zA-Z0-9]+\.lhr\.life)/);
    if (match) {
      const url = match[0];
      console.log(`\n=======================================================`);
      console.log(`[Tunnel Supervisor] ACTIVE FALLBACK LIVE URL: ${url}`);
      console.log(`=======================================================\n`);
      updateStatus('localhost.run', url, 'active');
      failedHealthChecks = 0;
      startHealthChecks();
    }
  });

  proc.stderr.on('data', (data) => {
    // Keep alive or debug
  });

  proc.on('close', (code) => {
    console.log(`[Tunnel Supervisor] Localhost.run exited (code ${code}). Retrying in 3 seconds...`);
    updateStatus('localhost.run', null, 'disconnected');
    setTimeout(startSupervisor, 3000);
  });
}

function startSupervisor() {
  if (fs.existsSync(CLOUDFLARED_BIN)) {
    startCloudflareTunnel();
  } else {
    startLocalhostRunTunnel();
  }
}

process.on('SIGINT', () => {
  if (currentProc) currentProc.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (currentProc) currentProc.kill();
  process.exit(0);
});

startSupervisor();
