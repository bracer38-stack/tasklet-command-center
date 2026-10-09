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

const sessionId = 'devin-9ad6e6df0f334bd69d7b25a5c1f0621e';

const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
};
if (orgId) headers['X-Org-Id'] = orgId;

const req = https.request({
  hostname: 'api.devin.ai',
  port: 443,
  path: `/v1/sessions/${sessionId}`,
  method: 'GET',
  headers,
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const body = JSON.parse(data);
      console.log('Session Status:', body.status_enum || body.status);
      console.log('Title:', body.title);
      const events = body.events || body.messages || [];
      console.log('Total events in session:', events.length);
      
      const devinEvents = events.filter(e => e.type === 'devin_message');
      console.log('Devin messages count:', devinEvents.length);
      
      const lastDevin = devinEvents[devinEvents.length - 1];
      if (lastDevin) {
        fs.writeFileSync('devin_review.md', lastDevin.message, 'utf8');
        console.log('\n✓ Saved full Devin review to devin_review.md (' + lastDevin.message.length + ' chars)');
      }
    } catch (err) {
      console.error('Error parsing response:', err, data);
    }
  });
});

req.on('error', console.error);
req.end();
