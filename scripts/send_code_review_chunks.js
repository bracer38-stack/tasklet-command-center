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

function sendMessage(msg) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ message: msg });
    const req = https.request({
      hostname: 'api.devin.ai',
      port: 443,
      path: `/v1/sessions/${sessionId}/message`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log(`Preparing code review packages for Devin session: ${sessionId}...`);

  const typesCode = fs.readFileSync('src/types/index.ts', 'utf8');
  const reconEngineCode = fs.readFileSync('src/services/reconciliationEngine.ts', 'utf8');
  const parserLines = fs.readFileSync('src/services/recordTypeParser.ts', 'utf8').split('\n');
  const parserPart1 = parserLines.slice(0, 516).join('\n');
  const parserPart2 = parserLines.slice(516).join('\n');
  const creditEngineCode = fs.readFileSync('src/services/creditEngine.ts', 'utf8');
  const classEngineCode = fs.readFileSync('src/services/classificationEngine.ts', 'utf8');
  const backupServiceCode = fs.readFileSync('scripts/backup_service.js', 'utf8');

  // Chunk 1: Overview + Types + Reconciliation Engine
  const chunk1 = `### Tasklet Financial Command Center — Code Review (Part 1 of 4)

Hey Devin! Here is the architecture and core code for our **Tasklet Financial Command Center** from Google Antigravity.
Since the repository is currently in our local scratch environment, we are delivering the core services directly to you here for review.

**Project Context**:
- **Stack**: React 18, TypeScript, Vite, Tailwind CSS, Node.js sync server.
- **Purpose**: Dual-entity (Business & Personal) financial operating system. Segregates restricted collateral (pledged savings), calculates **True Available Cash** vs. **Total Settled Cash**, tracks revolving debt & credit limits, and enforces zero-guessing transaction classification with complete audit lineage.

#### File 1: Core Data Models (\`src/types/index.ts\`)
\`\`\`typescript
${typesCode}
\`\`\`

#### File 2: Liquidity & Reconciliation Engine (\`src/services/reconciliationEngine.ts\`)
\`\`\`typescript
${reconEngineCode}
\`\`\`

(Continuing with Part 2: Universal Multi-Record Ingestion Parser...)`;

  // Chunk 2: Record Type Parser Part 1
  const chunk2 = `### Tasklet Financial Command Center — Code Review (Part 2 of 4)

#### File 3 (Part A): Multi-Record Ingestion Parser (\`src/services/recordTypeParser.ts\` - Lines 1-516)
This parser strictly separates transactions, account snapshots, bills, loans, and assumptions without merge conflicts or description-guessing:

\`\`\`typescript
${parserPart1}
\`\`\`

(Continuing with Part 3...)`;

  // Chunk 3: Record Type Parser Part 2
  const chunk3 = `### Tasklet Financial Command Center — Code Review (Part 3 of 4)

#### File 3 (Part B): Multi-Record Ingestion Parser Normalizers & Handlers (\`src/services/recordTypeParser.ts\` - Lines 517-1021)
This section handles transaction normalization, account snapshot balances, bill/loan ingestion, and mathematical variance reporting:

\`\`\`typescript
${parserPart2}
\`\`\`

(Continuing with Part 4: Credit Engine, Classification & Backup Service...)`;

  // Chunk 4: Credit Engine + Classification Engine + Backup Service + Review Directives
  const chunk4 = `### Tasklet Financial Command Center — Code Review (Part 4 of 4)

#### File 4: Credit & Debt Tracking Engine (\`src/services/creditEngine.ts\`)
\`\`\`typescript
${creditEngineCode}
\`\`\`

#### File 5: Transaction Classification & Audit Engine (\`src/services/classificationEngine.ts\`)
\`\`\`typescript
${classEngineCode}
\`\`\`

#### File 6: Automated Backup Service (\`scripts/backup_service.js\`)
\`\`\`javascript
${backupServiceCode}
\`\`\`

---

### What We Would Like You to Review:
1. **Mathematical & Financial Accuracy**: Check for potential floating-point pitfalls, negative sign inversions (e.g. debits vs credits across bank formats), or collateral exclusion bugs.
2. **Parser Robustness**: Review \`recordTypeParser.ts\` for CSV edge cases, quote escaping, unhandled date formats, or account slug collisions.
3. **Code Cleanup & Refactoring**: Identify redundant logic, dead code, or ways to simplify the services while maintaining 100% test coverage.
4. **Data Integrity & Persistence**: Evaluate the backup strategy and state transitions.

Please share your prioritized review findings, any issues or edge cases spotted, and concrete cleanup suggestions!`;

  const chunks = [
    { name: 'Part 1 (Architecture, Types, Liquidity Engine)', content: chunk1 },
    { name: 'Part 2 (Multi-Record Ingestion Parser Part A)', content: chunk2 },
    { name: 'Part 3 (Multi-Record Ingestion Parser Part B)', content: chunk3 },
    { name: 'Part 4 (Credit, Classification, Backup & Directives)', content: chunk4 },
  ];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`\n[${i + 1}/${chunks.length}] Sending ${chunk.name} (${chunk.content.length} characters)...`);
    if (chunk.content.length >= 30000) {
      console.error(`ERROR: Chunk ${i + 1} exceeds 30,000 characters (${chunk.content.length})! Aborting.`);
      process.exit(1);
    }
    const res = await sendMessage(chunk.content);
    console.log(`Status: ${res.statusCode} | Response: ${res.data.substring(0, 100)}`);
    if (res.statusCode !== 200) {
      console.error(`Failed on chunk ${i + 1}`);
      process.exit(1);
    }
    // Small delay between chunk dispatches
    await sleep(2500);
  }

  console.log('\n✓ All 4 code review packages successfully delivered to Devin session!');
}

run().catch(console.error);
