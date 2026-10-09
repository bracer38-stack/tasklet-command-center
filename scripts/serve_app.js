import http from 'http';
import fs from 'fs';
import path from 'path';
import {
  performBackup,
  listBackups,
  getBackupConfig,
  saveBackupConfig,
} from './backup_service.js';

const PORT = 5173;
const DIST = path.resolve('dist');
const DATA_DIR = path.resolve('data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
const LEDGER_FILE = path.join(DATA_DIR, 'shared_ledger.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Automated Daily Backup Check (every 60 minutes)
function checkScheduledBackup() {
  const config = getBackupConfig();
  if (!config.autoBackupEnabled) return;

  const now = Date.now();
  const lastTime = config.lastBackupTime ? new Date(config.lastBackupTime).getTime() : 0;
  const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

  if (hoursSinceLast >= (config.frequencyHours || 24)) {
    console.log(`[Backup Service] Triggering automated daily backup (${hoursSinceLast.toFixed(1)}h since last backup)...`);
    const result = performBackup('scheduled_daily');
    console.log('[Backup Service] Automated daily backup complete:', result.summary?.lastBackupStatus || result.success);
  }
}

// Run check on startup and schedule hourly verification
setTimeout(checkScheduledBackup, 5000);
setInterval(checkScheduledBackup, 60 * 60 * 1000);

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const urlPath = urlObj.pathname;

  // API Endpoint: /api/ledger (synchronize shared state across desktop and mobile devices)
  if (urlPath === '/api/ledger') {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      if (fs.existsSync(LEDGER_FILE)) {
        try {
          const content = fs.readFileSync(LEDGER_FILE, 'utf8');
          res.writeHead(200);
          res.end(content);
          return;
        } catch (e) {
          console.error('Error reading shared ledger:', e);
        }
      }
      res.writeHead(200);
      res.end(JSON.stringify({ exists: false }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          fs.writeFileSync(LEDGER_FILE, body, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, savedAt: new Date().toISOString() }));
          // Schedule backup on change
          setTimeout(() => performBackup('ledger_mutation'), 2000);
        } catch (e) {
          console.error('Error writing shared ledger:', e);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Write failed' }));
        }
      });
      return;
    }
  }

  // API Endpoint: /api/backups (list backups and current config)
  if (urlPath === '/api/backups') {
    if (req.method === 'GET') {
      const config = getBackupConfig();
      const backups = listBackups();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ config, backups }));
      return;
    }
  }

  // API Endpoint: /api/backups/run (trigger manual backup and Google Drive sync)
  if (urlPath === '/api/backups/run') {
    if (req.method === 'POST') {
      const result = performBackup('manual_user_trigger');
      const backups = listBackups();
      const config = getBackupConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...result, backups, config }));
      return;
    }
  }

  // API Endpoint: /api/backups/config (get or update backup configuration)
  if (urlPath === '/api/backups/config') {
    if (req.method === 'GET') {
      const config = getBackupConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const updated = saveBackupConfig(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(updated));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // API Endpoint: /api/backups/download?file=...
  if (urlPath === '/api/backups/download') {
    const fileName = urlObj.searchParams.get('file');
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid file name');
      return;
    }

    const filePath = path.join(BACKUPS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Static files from dist/
  let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Tasklet App serving with Shared Ledger & Backup API on port ${PORT}`);
});
