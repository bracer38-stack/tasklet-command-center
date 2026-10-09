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
  console.error('Missing DEVIN_API_KEY');
  process.exit(1);
}

const sessionId = 'devin-9ad6e6df0f334bd69d7b25a5c1f0621e';

// Load key files to package for Devin
const typesCode = fs.readFileSync('src/types/index.ts', 'utf8');
const reconEngineCode = fs.readFileSync('src/services/reconciliationEngine.ts', 'utf8');
const recordParserCode = fs.readFileSync('src/services/recordTypeParser.ts', 'utf8');
const creditEngineCode = fs.readFileSync('src/services/creditEngine.ts', 'utf8');
const classEngineCode = fs.readFileSync('src/services/classificationEngine.ts', 'utf8');
const backupServiceCode = fs.readFileSync('scripts/backup_service.js', 'utf8');

const promptMessage = `Hey Devin! Here is the core architecture and code for the **Tasklet Financial Command Center** from our Google Antigravity environment.

Please review the codebase thoroughly for any potential bugs, calculation edge cases, and cleanup/refactoring opportunities.

---

### Project Context
- **Name**: Tasklet Financial Command Center
- **Stack**: React 18, TypeScript, Vite, Tailwind CSS, Node.js local sync server.
- **Purpose**: Dual-entity (Business & Personal) financial management platform. Reconciles multi-bank statement feeds (Plaid & CSV), segregates restricted collateral (e.g. pledged savings), calculates **True Available Cash** vs. **Total Settled Cash**, tracks revolving debt & credit limits, and enforces zero-guessing transaction classification with complete audit lineage.

---

### Key Source Files Provided for Review

#### 1. Core Data Models (\`src/types/index.ts\`)
\`\`\`typescript
${typesCode}
\`\`\`

#### 2. Liquidity & Reconciliation Engine (\`src/services/reconciliationEngine.ts\`)
\`\`\`typescript
${reconEngineCode}
\`\`\`

#### 3. Universal Multi-Record Ingestion Parser (\`src/services/recordTypeParser.ts\`)
\`\`\`typescript
${recordParserCode}
\`\`\`

#### 4. Credit & Debt Tracking Engine (\`src/services/creditEngine.ts\`)
\`\`\`typescript
${creditEngineCode}
\`\`\`

#### 5. Transaction Classification & Audit Engine (\`src/services/classificationEngine.ts\`)
\`\`\`typescript
${classEngineCode}
\`\`\`

#### 6. Automated Backup & Cloud Sync Service (\`scripts/backup_service.js\`)
\`\`\`javascript
${backupServiceCode}
\`\`\`

---

### What We Would Like You to Review
1. **Mathematical & Financial Accuracy**: Check for any potential floating-point pitfalls, negative sign inversions (e.g. debits vs credits across bank formats), or collateral exclusion bugs.
2. **Parser Robustness**: Review \`recordTypeParser.ts\` for CSV edge cases, quote escaping, unhandled date formats, or account slug collisions.
3. **Code Cleanup & Refactoring**: Identify any redundant logic, dead code, or ways to simplify the services while maintaining 100% test coverage.
4. **Data Integrity & Persistence**: Evaluate the backup strategy and state transitions.

Please share your prioritized review findings, any issues or edge cases spotted, and concrete cleanup suggestions!`;

console.log(`Sending code review package to Devin session ${sessionId} (${promptMessage.length} characters)...`);

const req = https.request({
  hostname: 'api.devin.ai',
  port: 443,
  path: `/v1/sessions/${sessionId}/message`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
}, (res) => {
  console.log('HTTP Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
    if (res.statusCode === 200) {
      console.log('\n✓ Successfully delivered full code review package to Devin!');
    } else {
      console.error('\n✗ Failed with status:', res.statusCode);
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
});

req.write(JSON.stringify({ message: promptMessage }));
req.end();
