import https from 'https';
import fs from 'fs';
import path from 'path';

let apiKey = process.env.DEVIN_API_KEY;
let orgId = process.env.DEVIN_ORG_ID;

const envFile = path.resolve('.env');
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DEVIN_API_KEY=')) {
      apiKey = trimmed.substring('DEVIN_API_KEY='.length).trim();
    }
    if (trimmed.startsWith('DEVIN_ORG_ID=')) {
      orgId = trimmed.substring('DEVIN_ORG_ID='.length).trim();
    }
  }
}

if (!apiKey) {
  console.error('Error: DEVIN_API_KEY not found in environment or .env');
  process.exit(1);
}

function request(method, endpoint, payload = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (orgId) {
      headers['X-Org-Id'] = orgId;
    }

    const req = https.request({
      hostname: 'api.devin.ai',
      port: 443,
      path: endpoint,
      method: method,
      headers: headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(JSON.stringify(payload));
    req.end();
  });
}

async function main() {
  const [,, cmd, arg1, arg2] = process.argv;

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log('Devin CLI Commands:');
    console.log('  node scripts/devin_cli.js list                  - List Devin sessions');
    console.log('  node scripts/devin_cli.js get <session_id>      - Get session details');
    console.log('  node scripts/devin_cli.js create <prompt> [title] - Start new session');
    console.log('  node scripts/devin_cli.js msg <session_id> <msg> - Send message to session');
    return;
  }

  if (cmd === 'list') {
    const res = await request('GET', '/v1/sessions');
    if (res.status === 200 && res.body.sessions) {
      console.log(`\nFound ${res.body.sessions.length} Devin Sessions:`);
      res.body.sessions.forEach((s, idx) => {
        console.log(`[${idx + 1}] ID: ${s.session_id}`);
        console.log(`    Title:  ${s.title}`);
        console.log(`    Status: ${s.status} (${s.status_enum || 'active'})`);
        console.log(`    Created: ${s.created_at}`);
        if (s.pull_request) console.log(`    PR:     ${s.pull_request.url}`);
      });
    } else {
      console.log('Response:', res);
    }
  } else if (cmd === 'get') {
    if (!arg1) {
      console.error('Usage: node scripts/devin_cli.js get <session_id>');
      return;
    }
    const res = await request('GET', `/v1/sessions/${arg1}`);
    console.log(JSON.stringify(res.body, null, 2));
  } else if (cmd === 'create') {
    if (!arg1) {
      console.error('Usage: node scripts/devin_cli.js create <prompt> [title]');
      return;
    }
    const payload = { prompt: arg1 };
    if (arg2) payload.title = arg2;
    console.log('Dispatching new session to Devin...');
    const res = await request('POST', '/v1/sessions', payload);
    console.log('Response:', JSON.stringify(res.body, null, 2));
  } else if (cmd === 'msg') {
    if (!arg1 || !arg2) {
      console.error('Usage: node scripts/devin_cli.js msg <session_id> <message>');
      return;
    }
    const res = await request('POST', `/v1/sessions/${arg1}/message`, { message: arg2 });
    console.log('Response:', JSON.stringify(res.body, null, 2));
  } else {
    console.error(`Unknown command: ${cmd}`);
  }
}

main().catch(console.error);
