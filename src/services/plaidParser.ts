import { Account, Transaction } from '../types';
import { cleanMerchantName } from './normalization';
import { classifyTransaction } from './classificationEngine';

export function parseFinancialAmount(rawStr: string | number | null | undefined): number {
  if (rawStr === null || rawStr === undefined) return 0;
  if (typeof rawStr === 'number') return isNaN(rawStr) ? 0 : rawStr;
  const str = String(rawStr).trim();
  if (!str) return 0;

  const isParenNeg = /^\s*\(.*\)\s*$/.test(str);
  const isCreditSuffix = /\bCR\b/i.test(str);
  const hasMinus = str.includes('-') || isParenNeg || isCreditSuffix;

  // Strip currency symbols, commas, spaces, letters, parentheses
  const clean = str.replace(/[$€£,\s()]/g, '').replace(/[A-Za-z]/g, '').replace(/-/g, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;

  return hasMinus ? -num : num;
}

export interface PlaidJsonPayload {
  accounts?: Array<{
    account_id: string;
    name: string;
    official_name?: string;
    type?: string;
    subtype?: string;
    balances?: {
      available?: number | null;
      current?: number | null;
      limit?: number | null;
      iso_currency_code?: string;
    };
    mask?: string;
    last_synced?: string;
  }>;
  transactions?: Array<{
    transaction_id: string;
    account_id: string;
    amount: number;
    date: string;
    authorized_date?: string | null;
    name: string;
    merchant_name?: string | null;
    pending?: boolean;
    category?: string[];
    iso_currency_code?: string;
  }>;
}

export function parsePlaidJson(
  jsonData: string | object,
  existingAccounts: Account[] = []
): { accounts: Account[]; transactions: Transaction[] } {
  const data: PlaidJsonPayload =
    typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

  const accountsMap = new Map<string, Account>();
  existingAccounts.forEach((acc) => accountsMap.set(acc.id, acc));

  // Parse accounts if provided
  if (data.accounts && Array.isArray(data.accounts)) {
    data.accounts.forEach((acc) => {
      const type = (acc.type || 'depository') as Account['type'];
      const subtype = (acc.subtype || 'checking') as Account['subtype'];
      const isBusiness =
        acc.name.toLowerCase().includes('business') ||
        acc.name.toLowerCase().includes('operating') ||
        acc.name.toLowerCase().includes('corp') ||
        acc.name.toLowerCase().includes('mercury') ||
        acc.name.toLowerCase().includes('brex');

      const institution = acc.name.split(' ')[0] || 'Bank';

      const parsedAccount: Account = {
        id: acc.account_id,
        name: acc.name,
        officialName: acc.official_name || acc.name,
        institution,
        mask: acc.mask || '0000',
        type: ['depository', 'credit', 'loan', 'investment'].includes(type) ? type : 'depository',
        subtype: subtype || 'checking',
        currentBalance: acc.balances?.current ?? 0,
        availableBalance: acc.balances?.available ?? acc.balances?.current ?? 0,
        creditLimit: acc.balances?.limit ?? undefined,
        currency: acc.balances?.iso_currency_code || 'USD',
        lastSyncedAt: acc.last_synced || new Date().toISOString(),
        isStale: false,
        isBusiness,
        status: 'active',
      };

      accountsMap.set(parsedAccount.id, parsedAccount);
    });
  }

  const accounts = Array.from(accountsMap.values());
  const transactions: Transaction[] = [];

  if (data.transactions && Array.isArray(data.transactions)) {
    data.transactions.forEach((tx) => {
      const account = accountsMap.get(tx.account_id);
      const cleanMerchant = cleanMerchantName(tx.merchant_name || tx.name, tx.name);

      const baseTx: Transaction = {
        id: tx.transaction_id,
        accountId: tx.account_id,
        accountName: account?.name || 'Linked Account',
        institution: account?.institution || 'Bank',
        date: tx.date,
        authorizedDate: tx.authorized_date || undefined,
        rawDescription: tx.name,
        merchantName: tx.merchant_name || tx.name,
        cleanMerchant,
        // In Plaid standard: amount > 0 is debit/spend (outflow), amount < 0 is credit/income (inflow)
        amount: tx.amount,
        currency: tx.iso_currency_code || 'USD',
        pending: Boolean(tx.pending),
        category: tx.category || ['General'],
        classification: 'needs_review',
        auditTrail: [],
        anomalies: [],
      };

      // Run initial classification
      const { classification, auditEntry } = classifyTransaction(baseTx, account);
      baseTx.classification = classification;
      baseTx.auditTrail.push(auditEntry);

      transactions.push(baseTx);
    });
  }

  return { accounts, transactions };
}

export function parsePlaidCsv(
  csvContent: string,
  existingAccounts: Account[] = [],
  fallbackAccountName: string = 'Primary Business Checking'
): { accounts: Account[]; transactions: Transaction[] } {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must contain a header row and at least one data row.');
  }

  const headerRow = lines[0].toLowerCase();
  const headers = splitCsvRow(headerRow);

  // Map header indices
  const idIdx = headers.findIndex((h) => h.includes('transaction') || h === 'id' || h.endsWith('_id'));
  const accountIdx = headers.findIndex((h) => h.includes('account') || h.includes('bank'));
  const dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('posted'));
  const descIdx = headers.findIndex(
    (h) =>
      h.includes('description') ||
      h.includes('memo') ||
      h.includes('merchant') ||
      h.includes('payee') ||
      (h.includes('name') && !h.includes('account'))
  );
  const debitIdx = headers.findIndex((h) => h.includes('debit') || h.includes('withdrawal') || h.includes('charge'));
  const creditIdx = headers.findIndex((h) => (h.includes('credit') && !h.includes('card')) || h.includes('deposit'));
  const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('total') || h.includes('net'));
  const balanceIdx = headers.findIndex((h) => h.includes('balance'));
  const catIdx = headers.findIndex((h) => h.includes('category') || h.includes('type'));
  const pendingIdx = headers.findIndex((h) => h.includes('pending') || h.includes('status'));

  // Collect unique accounts detected in the CSV
  const discoveredAccountsMap = new Map<string, Account>();
  const existingAccountsMap = new Map<string, Account>();
  existingAccounts.forEach((a) => {
    existingAccountsMap.set(a.id.toLowerCase(), a);
    existingAccountsMap.set(a.name.toLowerCase(), a);
  });

  // Track running balance mapped to latest date
  const accountBalancesMap = new Map<string, { balance: number; date: string }>();

  // Pass 1: Parse rows into raw transaction candidates and collect accounts
  interface RawParsedRow {
    id: string;
    accountName: string;
    date: string;
    desc: string;
    amount: number;
    category: string;
    pending: boolean;
    balance?: number;
  }

  const parsedRows: RawParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    const rawId = idIdx >= 0 && cols[idIdx] ? cols[idIdx].trim() : `tx_csv_${Date.now()}_${i}`;
    const rawAccount = accountIdx >= 0 && cols[accountIdx] ? cols[accountIdx].trim() : fallbackAccountName;
    const date = dateIdx >= 0 && cols[dateIdx] ? cols[dateIdx].trim() : new Date().toISOString().split('T')[0];
    const desc = descIdx >= 0 && cols[descIdx] ? cols[descIdx].trim() : 'Bank Transaction';

    let amount = 0;
    if (debitIdx >= 0 && cols[debitIdx] && cols[debitIdx].trim() !== '') {
      // Debit column: outflow (positive in Plaid convention)
      const debitVal = parseFinancialAmount(cols[debitIdx]);
      if (debitVal !== 0) amount = Math.abs(debitVal);
    }
    if (creditIdx >= 0 && cols[creditIdx] && cols[creditIdx].trim() !== '') {
      // Credit column: inflow (negative in Plaid convention)
      const creditVal = parseFinancialAmount(cols[creditIdx]);
      if (creditVal !== 0) amount = -Math.abs(creditVal);
    }
    if (amount === 0 && amountIdx >= 0 && cols[amountIdx]) {
      amount = parseFinancialAmount(cols[amountIdx]);
    }

    let rowBalance: number | undefined = undefined;
    if (balanceIdx >= 0 && cols[balanceIdx]) {
      const parsedBal = parseFinancialAmount(cols[balanceIdx]);
      if (parsedBal !== 0 || cols[balanceIdx].includes('0')) {
        rowBalance = Math.abs(parsedBal);
        const existingRec = accountBalancesMap.get(rawAccount);
        if (!existingRec || date >= existingRec.date) {
          accountBalancesMap.set(rawAccount, { balance: rowBalance, date });
        }
      }
    }

    const catStr = catIdx >= 0 && cols[catIdx] ? cols[catIdx].trim() : 'General';
    const pendingStr = pendingIdx >= 0 && cols[pendingIdx] ? cols[pendingIdx].toLowerCase().trim() : 'false';
    const pending = pendingStr === 'true' || pendingStr === 'pending';

    parsedRows.push({
      id: rawId,
      accountName: rawAccount,
      date,
      desc,
      amount,
      category: catStr,
      pending,
      balance: rowBalance,
    });
  }

  // Pass 2: Detect or create accounts
  const accountSums = new Map<string, { inflows: number; outflows: number; count: number }>();
  parsedRows.forEach((r) => {
    const accKey = r.accountName;
    const current = accountSums.get(accKey) || { inflows: 0, outflows: 0, count: 0 };
    if (r.amount < 0) {
      current.inflows += Math.abs(r.amount);
    } else {
      current.outflows += r.amount;
    }
    current.count += 1;
    accountSums.set(accKey, current);
  });

  // Build Account objects
  for (const [accName, stats] of accountSums.entries()) {
    const lowerName = accName.toLowerCase();
    const existing = existingAccountsMap.get(lowerName);

    if (existing) {
      discoveredAccountsMap.set(accName, existing);
    } else {
      const isCredit =
        lowerName.includes('card') ||
        lowerName.includes('credit') ||
        lowerName.includes('amex') ||
        lowerName.includes('visa') ||
        lowerName.includes('mastercard') ||
        lowerName.includes('spark') ||
        lowerName.includes('platinum') ||
        lowerName === 'apg' ||
        lowerName.includes('apg');

      const isLoan = lowerName.includes('loan') || lowerName.includes('mortgage') || lowerName.includes('debt');
      const isSavings = lowerName.includes('saving');

      let institution = 'Bank';
      if (lowerName.includes('bank of america') || lowerName.includes('bofa')) institution = 'Bank of America';
      else if (lowerName.includes('u.s. bank') || lowerName.includes('us bank')) institution = 'U.S. Bank';
      else if (lowerName.includes('chase')) institution = 'Chase';
      else if (lowerName.includes('mercury')) institution = 'Mercury';
      else if (lowerName.includes('brex')) institution = 'Brex';
      else if (lowerName.includes('amex') || lowerName.includes('american express') || lowerName === 'apg' || lowerName.includes('apg')) institution = 'Amex';
      else if (lowerName.includes('wells')) institution = 'Wells Fargo';
      else if (lowerName.includes('citi')) institution = 'Citi';
      else if (lowerName.includes('capital one')) institution = 'Capital One';
      else if (lowerName.includes('svb')) institution = 'Silicon Valley Bank';
      else if (lowerName.includes('stripe')) institution = 'Stripe';

      // Extract 4-digit account mask if present in account name
      const maskMatch = accName.match(/(\d{4})/);
      const mask = maskMatch ? maskMatch[1] : '••••';

      // Starting balance calculation:
      // If balance was found in CSV column, use latest date's balance!
      // Otherwise, net cash flow (inflows - outflows)
      const balanceRec = accountBalancesMap.get(accName);
      let initialBal = balanceRec ? balanceRec.balance : undefined;
      if (initialBal === undefined) {
        if (isCredit) {
          initialBal = stats.outflows; // Outstanding spend balance
        } else {
          initialBal = Math.max(0, stats.inflows - stats.outflows);
          if (initialBal === 0 && stats.outflows > 0) {
            initialBal = stats.outflows * 1.5;
          }
        }
      }

      const isPersonalAccount =
        lowerName.includes('personal') ||
        lowerName.includes('household') ||
        lowerName.includes('sapphire');

      const isChargeCard =
        lowerName.includes('platinum') ||
        lowerName.includes('centurion') ||
        lowerName.includes('charge');

      const subtype: Account['subtype'] = isCredit
        ? 'credit_card'
        : isLoan
        ? 'term_loan'
        : isSavings
        ? 'savings'
        : 'checking';

      const accId = `acc_discovered_${lowerName.replace(/[^a-z0-9]/g, '_')}`;
      const newAcc: Account = {
        id: accId,
        name: accName,
        officialName: `${accName} (Imported)`,
        institution,
        mask,
        type: isCredit ? 'credit' : isLoan ? 'loan' : 'depository',
        subtype,
        currentBalance: Math.round(initialBal * 100) / 100,
        availableBalance: Math.round(initialBal * 100) / 100,
        creditLimit: isCredit
          ? isChargeCard
            ? undefined
            : initialBal > 0
            ? Math.min(25000, Math.max(5000, Math.round(initialBal * 1.25)))
            : 15000
          : undefined,
        isNoPresetLimit: isChargeCard,
        currency: 'USD',
        lastSyncedAt: new Date().toISOString(),
        isStale: false,
        isBusiness: !isPersonalAccount,
        entity: isPersonalAccount ? 'personal' : 'business',
        status: 'active',
      };

      discoveredAccountsMap.set(accName, newAcc);
    }
  }

  const finalAccounts = Array.from(discoveredAccountsMap.values());
  const finalAccountMap = new Map<string, Account>();
  finalAccounts.forEach((a) => {
    finalAccountMap.set(a.name.toLowerCase(), a);
  });

  // Pass 3: Construct transactions and run classification
  const transactions: Transaction[] = [];

  for (const row of parsedRows) {
    const acc = finalAccountMap.get(row.accountName.toLowerCase()) || finalAccounts[0];
    const cleanMerchant = cleanMerchantName(row.desc, row.desc);

    const tx: Transaction = {
      id: row.id,
      sourceTxId: row.id,
      importBatchId: `batch_csv_${row.date}`,
      importedAt: new Date().toISOString(),
      accountId: acc.id,
      accountName: acc.name,
      institution: acc.institution,
      date: row.date,
      rawDescription: row.desc,
      merchantName: row.desc,
      cleanMerchant,
      amount: row.amount,
      currency: 'USD',
      pending: row.pending,
      category: [row.category],
      classification: 'needs_review',
      entity: acc.entity || (acc.isBusiness ? 'business' : 'personal'),
      auditTrail: [],
      anomalies: [],
    };

    const { classification, auditEntry } = classifyTransaction(tx, acc);
    tx.classification = classification;
    tx.auditTrail.push(auditEntry);

    transactions.push(tx);
  }

  return { accounts: finalAccounts, transactions };
}

function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
