import https from 'https';
import fs from 'fs';
import path from 'path';

function run() {
  const mcpConfigFile = path.resolve('.agents/mcp_config.json');
  let apiKey = process.env.DEVIN_API_KEY;
  let orgId = process.env.DEVIN_ORG_ID;

  if (fs.existsSync(mcpConfigFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(mcpConfigFile, 'utf8'));
      const devinCfg = cfg.mcpServers?.devin;
      if (devinCfg?.headers?.Authorization) {
        const token = devinCfg.headers.Authorization.replace('Bearer ', '').trim();
        if (token && token !== 'YOUR_DEVIN_API_KEY_HERE') {
          apiKey = token;
        }
      }
      if (devinCfg?.headers?.['X-Org-Id']) {
        orgId = devinCfg.headers['X-Org-Id'];
      }
    } catch {}
  }

  if (!apiKey || apiKey === 'YOUR_DEVIN_API_KEY_HERE') {
    console.log('No Devin API Key found. Please set DEVIN_API_KEY or configure .agents/mcp_config.json');
    process.exit(1);
  }

  console.log(`Connecting to Devin MCP server (https://mcp.devin.ai/mcp)...`);
  const headers = {
    'Accept': 'text/event-stream',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
  if (orgId) {
    headers['X-Org-Id'] = orgId;
  }

  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {},
  });

  const req = https.request('https://mcp.devin.ai/mcp', {
    method: 'POST',
    headers,
  }, (res) => {
    console.log(`HTTP Status: ${res.statusCode}`);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Response body:', data);
      if (res.statusCode === 200) {
        console.log('\n✓ Success! Devin MCP server authentication succeeded.');
      } else {
        console.error('\n✗ Devin MCP server responded with error status:', res.statusCode);
      }
    });
  });

  req.on('error', (err) => {
    console.error('Request failed:', err.message);
  });

  req.write(payload);
  req.end();
}

run();
