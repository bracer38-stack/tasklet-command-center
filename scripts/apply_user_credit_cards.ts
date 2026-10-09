import fs from 'fs';
import { parseRecordTypeContent } from '../src/services/recordTypeParser';
import { Account, FinancialNote } from '../src/types';

function run() {
  const ledgerPath = 'data/shared_ledger.json';
  const csvPath = 'data/user_credit_cards.csv';

  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const csvContent = fs.readFileSync(csvPath, 'utf8');

  const summary = parseRecordTypeContent(csvContent, {
    fileName: 'user_credit_cards.csv',
    existingAccounts: ledger.rawAccounts,
  });

  console.log(`Parsed ${summary.parsedAccounts.length} accounts and ${summary.parsedNotes.length} notes from CSV.`);

  const updatedAccounts: Account[] = [...ledger.rawAccounts];

  summary.parsedAccounts.forEach((incomingAcc) => {
    const matchIndex = updatedAccounts.findIndex((existing) => {
      if (existing.id === incomingAcc.id) return true;
      if (
        incomingAcc.mask &&
        incomingAcc.mask !== '••••' &&
        existing.mask &&
        existing.mask !== '••••' &&
        existing.mask === incomingAcc.mask
      ) {
        return true;
      }
      if (
        incomingAcc.mask &&
        incomingAcc.mask !== '••••' &&
        (existing.name.includes(incomingAcc.mask) || existing.id.includes(incomingAcc.mask))
      ) {
        return true;
      }

      // Keyword matching
      const inClean = incomingAcc.name.toLowerCase();
      const exClean = existing.name.toLowerCase();
      const exId = existing.id.toLowerCase();

      if (inClean.includes('travel rewards') && exId.includes('travel_rewards')) return true;
      if (inClean.includes('unlimited cash') && exId.includes('unlimited_cash')) return true;
      if ((inClean.includes('custom cash') || inClean.includes('customized cash')) && exId.includes('customized_cash')) return true;
      if (inClean.includes('costco') && exId.includes('costco')) return true;
      if (inClean.includes('mileup') && exId.includes('mileup')) return true;
      if (inClean.includes('citi aadvantage platinum') && exId.includes('citi__aadvantage__platinum')) return true;
      if (inClean.includes('home depot') && exId.includes('home_depot')) return true;
      if (inClean.includes('paypal cashback') && exId.includes('paypal_cashback')) return true;
      if (inClean.includes('paypal mastercard') && exId.includes('paypal_credit_card')) return true;
      if ((inClean.includes('amex') || inClean.includes('american express')) && exId.includes('american_express')) return true;
      if (inClean.includes('wsfs credit card') && existing.id === 'acc_credit_card') return true;

      return false;
    });

    if (matchIndex >= 0) {
      const existing = updatedAccounts[matchIndex];
      updatedAccounts[matchIndex] = {
        ...existing,
        name: incomingAcc.name.length > existing.name.length && !existing.name.includes('Direct') ? incomingAcc.name : existing.name,
        type: 'credit',
        subtype: 'credit_card',
        currentBalance: incomingAcc.currentBalance,
        availableBalance: incomingAcc.availableBalance,
        creditLimit: incomingAcc.creditLimit,
        interestRate: incomingAcc.interestRate ?? existing.interestRate,
        monthlyPayment: incomingAcc.monthlyPayment ?? existing.monthlyPayment,
        mask: incomingAcc.mask && incomingAcc.mask !== '••••' ? incomingAcc.mask : existing.mask,
        status: incomingAcc.status || existing.status,
        lastSyncedAt: incomingAcc.lastSyncedAt,
      };
      console.log(`  Updated existing account: ${existing.name} -> ${incomingAcc.name} (Bal: $${incomingAcc.currentBalance}, Limit: $${incomingAcc.creditLimit})`);
    } else {
      updatedAccounts.push(incomingAcc);
      console.log(`  Added new card account: ${incomingAcc.name} (Bal: $${incomingAcc.currentBalance}, Limit: $${incomingAcc.creditLimit})`);
    }
  });

  // Merge notes
  const existingNoteIds = new Set((ledger.notes || []).map((n: FinancialNote) => n.id));
  const newNotes: FinancialNote[] = [...(ledger.notes || [])];
  summary.parsedNotes.forEach((note) => {
    if (!existingNoteIds.has(note.id)) {
      newNotes.push(note);
    }
  });

  ledger.rawAccounts = updatedAccounts;
  ledger.notes = newNotes;
  ledger.dataMode = 'imported_csv';
  ledger.updatedAt = new Date().toISOString();

  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
  console.log(`\nSuccessfully saved updated shared ledger!`);
  console.log(`Total accounts: ${updatedAccounts.length}`);
  console.log(`Total notes: ${newNotes.length}`);
}

run();
