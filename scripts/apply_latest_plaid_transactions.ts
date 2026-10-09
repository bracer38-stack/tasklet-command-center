import fs from 'fs';
import path from 'path';
import { parseRecordTypeContent } from '../src/services/recordTypeParser';
import { performBackup } from './backup_service.js';
import { Transaction } from '../src/types';

function run() {
  const ledgerPath = path.resolve('data/shared_ledger.json');
  const userCsvSource = 'C:/Users/brace/.gemini/antigravity/brain/1949cb98-28e7-47cc-8ca1-02d885a6fcd0/.user_uploaded/media_1791253960139.csv';
  const targetCsvPath = path.resolve('data/latest_plaid_import.csv');
  const bankStatementPath = path.resolve('data/bank_statement.csv');

  if (!fs.existsSync(userCsvSource)) {
    throw new Error(`Source user CSV not found at ${userCsvSource}`);
  }

  const csvContent = fs.readFileSync(userCsvSource, 'utf8');
  fs.writeFileSync(targetCsvPath, csvContent, 'utf8');
  fs.writeFileSync(bankStatementPath, csvContent, 'utf8');
  console.log(`✓ Copied user CSV to ${targetCsvPath} and ${bankStatementPath}`);

  const ledgerRaw = fs.readFileSync(ledgerPath, 'utf8');
  const ledger = JSON.parse(ledgerRaw);

  const existingTxIds = new Set<string>((ledger.rawTransactions || []).map((t: Transaction) => t.id));

  const summary = parseRecordTypeContent(csvContent, {
    fileName: 'bank_statement.csv',
    existingAccounts: ledger.rawAccounts,
    existingTransactionIds: existingTxIds,
  });

  console.log('\n--- Ingestion Reconciliation Summary ---');
  console.log(`Rows Read: ${summary.rowsRead}`);
  console.log(`Accepted Count: ${summary.acceptedCount}`);
  console.log(`Rejected Count: ${summary.rejectedCount}`);
  console.log(`Duplicates Skipped: ${summary.duplicatesSkippedCount}`);
  console.log(`Raw Debits: $${summary.variance?.rawDebits.toFixed(2)}`);
  console.log(`Staged Debits: $${summary.variance?.stagedDebits.toFixed(2)}`);
  console.log(`Variance Delta: $${summary.variance?.deltaDebits.toFixed(2)}`);
  console.log(`Variance Explanation: ${summary.variance?.explanation}`);

  if (summary.rejectedCount > 0) {
    console.error('Rejections occurred:', summary.rejections);
    throw new Error(`Failed to ingest: ${summary.rejectedCount} records rejected`);
  }

  console.log('\n--- Parsed Transactions ---');
  summary.parsedTransactions.forEach((tx, idx) => {
    console.log(`[${idx + 1}] ID: ${tx.id}`);
    console.log(`    Account: ${tx.accountName} (${tx.accountId})`);
    console.log(`    Date: ${tx.date} | Status: ${tx.status} | Pending: ${tx.pending}`);
    console.log(`    Merchant / Desc: ${tx.cleanMerchant || tx.rawDescription}`);
    console.log(`    Amount: $${tx.amount.toFixed(2)} | Classification: ${tx.classification}`);
  });

  const prevTxCount = ledger.rawTransactions.length;
  // Prepend newly added pending transactions so they appear at the top of the transaction feed
  ledger.rawTransactions = [...summary.parsedTransactions, ...ledger.rawTransactions];
  ledger.updatedAt = new Date().toISOString();
  ledger.latestReconciliationReport = {
    importedAt: ledger.updatedAt,
    fileName: 'bank_statement.csv',
    ...summary,
  };

  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
  console.log(`\n✓ Successfully committed transactions to ${ledgerPath}`);
  console.log(`  Previous count: ${prevTxCount} -> New count: ${ledger.rawTransactions.length}`);

  // Trigger backup
  const backupRes = performBackup('user_plaid_import');
  console.log('\n--- Automated Backup Status ---');
  console.log(JSON.stringify(backupRes, null, 2));
}

run();
