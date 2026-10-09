import https from 'https';
import fs from 'fs';
import path from 'path';

// Load credentials from environment or .env file
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

function devinApiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (orgId) {
      headers['X-Org-Id'] = orgId;
    }

    const options = {
      hostname: 'api.devin.ai',
      port: 443,
      path: endpoint,
      method: method,
      headers: headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const TOOLS = [
  {
    name: 'devin_list_sessions',
    description: 'List active and recent Devin sessions with their status, title, creation time, and IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of sessions to return (default: 20)' },
      },
    },
  },
  {
    name: 'devin_get_session',
    description: 'Get details, status, pull request link, structured output, and messages for a specific Devin session.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The unique ID of the Devin session (e.g. devin-xxx)' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'devin_create_session',
    description: 'Spawn a new autonomous Devin coding session with a prompt, title, and optional tags.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Detailed instructions and task description for Devin' },
        title: { type: 'string', description: 'Human-readable title for the session' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional list of tags for organization' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'devin_send_message',
    description: 'Send a message or reply with additional instructions to an active Devin session.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The unique ID of the Devin session' },
        message: { type: 'string', description: 'The message or instruction to send to Devin' },
      },
      required: ['session_id', 'message'],
    },
  },
];

async function handleToolCall(name, args) {
  switch (name) {
    case 'devin_list_sessions': {
      const res = await devinApiRequest('GET', '/v1/sessions');
      return res.data;
    }
    case 'devin_get_session': {
      const { session_id } = args;
      const res = await devinApiRequest('GET', `/v1/sessions/${session_id}`);
      return res.data;
    }
    case 'devin_create_session': {
      const { prompt, title, tags } = args;
      const payload = { prompt };
      if (title) payload.title = title;
      if (tags) payload.tags = tags;
      const res = await devinApiRequest('POST', '/v1/sessions', payload);
      return res.data;
    }
    case 'devin_send_message': {
      const { session_id, message } = args;
      const res = await devinApiRequest('POST', `/v1/sessions/${session_id}/message`, { message });
      return res.data;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Stdio JSON-RPC MCP Server implementation
let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  processLines();
});

function processLines() {
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep last incomplete chunk

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      handleMessage(msg);
    } catch (e) {
      // Ignore or log non-JSON lines
    }
  }
}

async function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: 'devin-mcp-server',
        version: '1.0.0',
      },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    // Initialized notification; no response needed
    return;
  }

  if (method === 'tools/list') {
    sendResponse(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};
    try {
      const result = await handleToolCall(toolName, toolArgs);
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      });
    } catch (err) {
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: `Error executing ${toolName}: ${err.message}`,
          },
        ],
        isError: true,
      });
    }
    return;
  }

  if (id !== undefined) {
    sendResponse(id, { error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

function sendResponse(id, resultOrError) {
  const response = {
    jsonrpc: '2.0',
    id: id,
    ...resultOrError,
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

console.error('[Devin MCP Server] Initialized and listening on stdio.');
