import fs from 'fs';
import { parseRecordTypeContent } from '../src/services/recordTypeParser';

const csvContent = fs.readFileSync('data/user_credit_cards.csv', 'utf8');
const summary = parseRecordTypeContent(csvContent, {
  fileName: 'user_credit_cards.csv',
});

console.log('--- Reconciliation Summary ---');
console.log('Rows Read:', summary.rowsRead);
console.log('Accepted Count:', summary.acceptedCount);
console.log('Rejected Count:', summary.rejectedCount);
console.log('Parsed Accounts:', summary.parsedAccounts.length);
console.log('Parsed Notes:', summary.parsedNotes.length);
console.log('Rejections:', summary.rejections);
