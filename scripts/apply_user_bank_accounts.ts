import fs from 'fs';
import { parseRecordTypeContent } from '../src/services/recordTypeParser';
import { Account, FinancialNote, FinancialEntity } from '../src/types';

function run() {
  const ledgerPath = 'data/shared_ledger.json';
  const csvPath = 'data/user_bank_accounts.csv';

  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const csvContent = fs.readFileSync(csvPath, 'utf8');

  const summary = parseRecordTypeContent(csvContent, {
    fileName: 'user_bank_accounts.csv',
    existingAccounts: ledger.rawAccounts,
  });

  console.log(`Parsed ${summary.parsedAccounts.length} bank accounts and ${summary.parsedNotes.length} notes from CSV.`);

  const accounts: Account[] = [...ledger.rawAccounts];

  // 1. Reclassify Royal ONE Visa Signature to Credit Card
  const royalIndex = accounts.findIndex((a) => a.id === 'acc_royal_one_visa_signature' || a.name.toLowerCase().includes('royal one'));
  if (royalIndex >= 0) {
    accounts[royalIndex] = {
      ...accounts[royalIndex],
      name: 'Royal ONE Visa Signature',
      type: 'credit',
      subtype: 'credit_card',
      institution: 'Royal ONE',
      mask: '••••',
      currentBalance: 0,
      availableBalance: null,
      isBusiness: false,
      entity: 'personal',
      status: 'active',
      lastSyncedAt: new Date().toISOString(),
    };
    console.log(`✓ Reclassified Royal ONE Visa Signature to credit/credit_card`);
  }

  // 2. Reclassify Visa and Platinum Rewards if misclassified
  const visaIndex = accounts.findIndex((a) => a.id === 'acc_visa');
  if (visaIndex >= 0) {
    accounts[visaIndex] = {
      ...accounts[visaIndex],
      name: 'Visa Card',
      type: 'credit',
      subtype: 'credit_card',
      institution: 'Visa',
      mask: '••••',
      isBusiness: false,
      entity: 'personal',
    };
    console.log(`✓ Reclassified acc_visa to credit/credit_card`);
  }

  const platIndex = accounts.findIndex((a) => a.id === 'acc_platinum_rewards');
  if (platIndex >= 0) {
    accounts[platIndex] = {
      ...accounts[platIndex],
      name: 'Platinum Rewards Card',
      type: 'credit',
      subtype: 'credit_card',
      institution: 'PenFed',
      mask: '5614',
      isBusiness: false,
      entity: 'personal',
    };
    console.log(`✓ Reclassified acc_platinum_rewards to credit/credit_card`);
  }

  // Mapping from parsed incoming account name/mask to existing ledger ID
  const mapIncomingToExistingId: Record<string, string> = {
    'wsfs checking #6195': 'acc_wsfs_direct_checking',
    'boa checking #4488 (personal checking)': 'acc_adv_relationship_banking',
    'boa adv plus #2189': 'acc_adv_plus_banking',
    'capital one 360 checking #8210': 'acc_360_checking',
    'dexsta checking #7073': 'acc_share_draft',
    'apg fcu hy checking #3798': 'acc_high_yield_checking',
    'upgrade checking #0787': 'acc_rewards_checking_preferred',
    'venmo wallet': 'acc_personal_profile',
    'paypal balance': 'acc_paypal',
    'penfed free checking': 'acc_free_checking',
    'penfed regular savings': 'acc_regular_savings',
    'savings #4462 (team rhino)': 'acc_advantage_savings',
    'apg fcu savings #3019': 'acc_regular_share',
    'amex high yield savings #2026': 'acc_high_yield_savings_account',
    'dexsta special share #0020': 'acc_special_share',
    'dexsta prime share #0001': 'acc_prime_share',
    'us bank savings #2806': 'acc_savings___2806',
    'upgrade performance savings #3891': 'acc_performance_savings',
  };

  const matchedExistingIds = new Set<string>();

  summary.parsedAccounts.forEach((incomingAcc) => {
    const key = incomingAcc.name.toLowerCase().trim();
    const targetExistingId = mapIncomingToExistingId[key];

    const numMatch = incomingAcc.name.match(/#(\d{4})/);
    const cleanMask = incomingAcc.mask && incomingAcc.mask !== '••••' 
      ? incomingAcc.mask 
      : numMatch 
      ? numMatch[1] 
      : '••••';

    let cleanInstitution = incomingAcc.institution;
    if (incomingAcc.name.includes('WSFS')) cleanInstitution = 'WSFS';
    else if (incomingAcc.name.includes('BOA')) cleanInstitution = 'Bank of America';
    else if (incomingAcc.name.includes('Capital One')) cleanInstitution = 'Capital One';
    else if (incomingAcc.name.includes('DEXSTA')) cleanInstitution = 'DEXSTA FCU';
    else if (incomingAcc.name.includes('APG FCU')) cleanInstitution = 'APG FCU';
    else if (incomingAcc.name.includes('Upgrade')) cleanInstitution = 'Upgrade';
    else if (incomingAcc.name.includes('Venmo')) cleanInstitution = 'Venmo';
    else if (incomingAcc.name.includes('PayPal')) cleanInstitution = 'PayPal';
    else if (incomingAcc.name.includes('PenFed')) cleanInstitution = 'PenFed';
    else if (incomingAcc.name.includes('Team Rhino')) cleanInstitution = 'Bank of America';
    else if (incomingAcc.name.includes('Amex')) cleanInstitution = 'American Express';
    else if (incomingAcc.name.includes('EverBank')) cleanInstitution = 'EverBank';
    else if (incomingAcc.name.includes('US Bank')) cleanInstitution = 'US Bank';

    let targetIndex = -1;
    if (targetExistingId) {
      targetIndex = accounts.findIndex((a) => a.id === targetExistingId);
    }
    if (targetIndex === -1 && cleanMask && cleanMask !== '••••') {
      targetIndex = accounts.findIndex((a) => a.type === 'depository' && (a.mask === cleanMask || a.name.includes(cleanMask) || a.id.includes(cleanMask)));
    }
    if (targetIndex === -1) {
      targetIndex = accounts.findIndex((a) => a.type === 'depository' && a.name.toLowerCase().trim() === key);
    }

    if (targetIndex >= 0) {
      const existing = accounts[targetIndex];
      matchedExistingIds.add(existing.id);
      accounts[targetIndex] = {
        ...existing,
        name: incomingAcc.name,
        type: incomingAcc.type,
        subtype: incomingAcc.subtype,
        institution: cleanInstitution,
        mask: cleanMask,
        currentBalance: incomingAcc.currentBalance,
        availableBalance: incomingAcc.availableBalance,
        isBusiness: incomingAcc.isBusiness,
        entity: incomingAcc.entity || (incomingAcc.isBusiness ? 'business' : 'personal'),
        isStale: incomingAcc.isStale,
        status: incomingAcc.status || existing.status,
        lastSyncedAt: incomingAcc.lastSyncedAt,
      };
      console.log(`  ✓ Updated existing: [${existing.id}] ${existing.name} (••${cleanMask}) (Bal: $${incomingAcc.currentBalance}, Avail: $${incomingAcc.availableBalance})`);
    } else {
      // New account to append
      const newAcc = {
        ...incomingAcc,
        institution: cleanInstitution,
        mask: cleanMask,
      };
      accounts.push(newAcc);
      console.log(`  + Added new depository account: [${incomingAcc.id}] ${incomingAcc.name} (••${cleanMask}) (Bal: $${incomingAcc.currentBalance}, Avail: $${incomingAcc.availableBalance})`);
    }
  });

  // Verify and merge notes
  const existingNoteIds = new Set((ledger.notes || []).map((n: FinancialNote) => n.id));
  const newNotes: FinancialNote[] = [...(ledger.notes || [])];
  summary.parsedNotes.forEach((note) => {
    if (!existingNoteIds.has(note.id)) {
      newNotes.push(note);
    }
  });

  // Deduplicate accounts by id, and for depository accounts by name
  const seenIds = new Set<string>();
  const seenDepNames = new Set<string>();
  const finalAccounts: Account[] = [];
  accounts.forEach((a) => {
    if (seenIds.has(a.id)) return;
    if (a.type === 'depository') {
      const cleanName = a.name.toLowerCase().trim();
      if (seenDepNames.has(cleanName)) return;
      seenDepNames.add(cleanName);
    }
    seenIds.add(a.id);
    finalAccounts.push(a);
  });

  ledger.rawAccounts = finalAccounts;
  ledger.notes = newNotes;
  ledger.updatedAt = new Date().toISOString();

  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
  console.log(`\nSuccessfully applied user bank accounts to shared_ledger.json!`);

  // Print summary of depository accounts
  const depository = accounts.filter((a) => a.type === 'depository');
  console.log(`\n=== DEPOSITORY ACCOUNTS SUMMARY (${depository.length}) ===`);
  let totalBook = 0;
  let totalAvail = 0;
  depository.forEach((a, i) => {
    totalBook += a.currentBalance;
    totalAvail += a.availableBalance ?? a.currentBalance;
    console.log(`${i+1}. [${a.subtype}] ${a.name} (••${a.mask}) | Bal: $${a.currentBalance.toFixed(2)} | Avail: $${(a.availableBalance ?? a.currentBalance).toFixed(2)} | Biz: ${a.isBusiness} | Stale: ${a.isStale}`);
  });
  console.log(`Total Depository Book Cash: $${totalBook.toFixed(2)}`);
  console.log(`Total Available Cash: $${totalAvail.toFixed(2)}`);
}

run();
