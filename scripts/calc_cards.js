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
let totalBal = 0;
let totalLimit = 0;
let totalMinDue = 0;
let countWithBal = 0;

for (let i = 1; i < lines.length; i++) {
  const vals = splitCsvRow(lines[i]);
  const row = {};
  headers.forEach((h, idx) => row[h] = vals[idx] || '');
  const bal = parseFloat(row.reported_balance || '0') || 0;
  const lim = parseFloat(row.credit_limit || '0') || 0;
  const min = parseFloat(row.minimum_payment || '0') || 0;
  if (bal > 0) {
    totalBal += bal;
    countWithBal++;
  }
  totalLimit += lim;
  totalMinDue += min;
}

console.log('Total Revolving Balance:', totalBal.toFixed(2));
console.log('Total Credit Limit:', totalLimit.toFixed(2));
console.log('Cards with balance > 0:', countWithBal);
console.log('Total Minimum Monthly Payments:', totalMinDue.toFixed(2));
console.log('Overall Utilization:', ((totalBal / totalLimit) * 100).toFixed(2) + '%');
