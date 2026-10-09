import fs from 'fs';

function splitCsvRow(rowText) {
  const result = [];
  let currentVal = '';
  let inQuotes = false;
  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (char === '"') {
      if (inQuotes && rowText[i + 1] === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(currentVal.trim());
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  result.push(currentVal.trim());
  return result;
}

const ledger = JSON.parse(fs.readFileSync('data/shared_ledger.json', 'utf8'));
const existingAccounts = ledger.rawAccounts;

const raw = fs.readFileSync('data/user_credit_cards.csv', 'utf8');
const lines = [];
let currentLine = '';
let inQuotes = false;
for (let i = 0; i < raw.length; i++) {
  const c = raw[i];
  if (c === '"') {
    inQuotes = !inQuotes;
    currentLine += c;
  } else if ((c === '\n' || c === '\r') && !inQuotes) {
    if (c === '\r' && raw[i+1] === '\n') i++;
    if (currentLine.trim()) lines.push(currentLine);
    currentLine = '';
  } else {
    currentLine += c;
  }
}
if (currentLine.trim()) lines.push(currentLine);

const headers = splitCsvRow(lines[0]);

const matched = [];
const unmatched = [];
const creditAccounts = existingAccounts.filter(a => a.type === 'credit' || a.name.toLowerCase().includes('card') || a.name.toLowerCase().includes('rewards'));

for (let i = 1; i < lines.length; i++) {
  const vals = splitCsvRow(lines[i]);
  const row = {};
  headers.forEach((h, idx) => row[h] = vals[idx] || '');

  const cardName = row.card_name;
  const lastFour = row.last_four;

  // 1. Match by last 4 mask in credit accounts
  let match = null;
  if (lastFour && lastFour.length === 4) {
    match = creditAccounts.find(a => a.name.includes(lastFour) || a.id.includes(lastFour) || a.mask === lastFour);
  }

  // 2. Match by specific unique names if no mask match
  if (!match) {
    const cLower = cardName.toLowerCase();
    if (cLower.includes('travel rewards')) match = creditAccounts.find(a => a.id.includes('travel_rewards'));
    else if (cLower.includes('unlimited cash')) match = creditAccounts.find(a => a.id.includes('unlimited_cash'));
    else if (cLower.includes('custom cash') || cLower.includes('customized cash')) match = creditAccounts.find(a => a.id.includes('customized_cash'));
    else if (cLower.includes('costco')) match = creditAccounts.find(a => a.id.includes('costco'));
    else if (cLower.includes('mileup')) match = creditAccounts.find(a => a.id.includes('mileup'));
    else if (cLower.includes('citi aadvantage platinum')) match = creditAccounts.find(a => a.id.includes('citi__aadvantage__platinum'));
    else if (cLower.includes('home depot')) match = creditAccounts.find(a => a.id.includes('home_depot'));
    else if (cLower.includes('paypal cashback')) match = creditAccounts.find(a => a.id.includes('paypal_cashback'));
    else if (cLower.includes('paypal mastercard')) match = creditAccounts.find(a => a.id.includes('paypal_credit_card'));
    else if (cLower.includes('amex') || cLower.includes('american express')) match = creditAccounts.find(a => a.id.includes('american_express'));
    else if (cLower.includes('wsfs credit card')) match = creditAccounts.find(a => a.id === 'acc_credit_card');
  }

  if (match) {
    matched.push({ cardName, lastFour, existingId: match.id, existingName: match.name, row });
  } else {
    unmatched.push({ cardName, lastFour, balance: row.reported_balance, limit: row.credit_limit, row });
  }
}

console.log('Successfully matched existing card accounts (' + matched.length + '):');
matched.forEach(m => console.log(`  "${m.cardName}" (••••${m.lastFour}) -> "${m.existingName}" (${m.existingId})`));
console.log('\nNew card accounts to create (' + unmatched.length + '):');
unmatched.forEach(u => console.log(`  "${u.cardName}" (••••${u.lastFour}) bal: ${u.balance}, limit: ${u.limit}`));
