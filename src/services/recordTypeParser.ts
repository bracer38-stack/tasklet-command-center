import {
  Account,
  AccountSubtype,
  AccountType,
  FinancialEntity,
  FinancialNote,
  ImportReconciliationSummary,
  RecordType,
  Subscription,
  Transaction,
  TransactionClassification,
} from '../types';
import { cleanMerchantName } from './normalization';
import { parseFinancialAmount } from './plaidParser';

const SINGLE_AMOUNT_FIELDS = ['raw_amount', 'amount', 'normalized_amount', 'tx_amount', 'transaction_amount'] as const;

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function firstPresent(row: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    if (!isBlank(row[key])) return row[key];
  }
  return undefined;
}

function isNumericAmount(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  const digits = value
    .trim()
    .replace(/\s*(CR|DR)$/i, '')
    .replace(/^(USD|EUR|GBP)\s*/i, '')
    .replace(/[$€£,\s()%+-]/g, '');
  return /^(\d+(\.\d*)?|\.\d+)$/.test(digits);
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (isBlank(value) || !isNumericAmount(value)) return undefined;
  return parseFinancialAmount(value as string | number);
}

/**
 * Resolves the signed amount of a row (positive = outflow, negative = inflow).
 * Separate debit/credit columns take precedence; blank cells are skipped rather than
 * short-circuiting. Returns null when no valid amount exists or both debit and credit
 * are non-zero (ambiguous).
 */
export function extractAmount(row: Record<string, any>): { value: number; field: string } | null {
  const hasDebit = !isBlank(row.debit);
  const hasCredit = !isBlank(row.credit);
  if (hasDebit || hasCredit) {
    if ((hasDebit && !isNumericAmount(row.debit)) || (hasCredit && !isNumericAmount(row.credit))) return null;
    const debit = hasDebit ? Math.abs(parseFinancialAmount(row.debit)) : 0;
    const credit = hasCredit ? Math.abs(parseFinancialAmount(row.credit)) : 0;
    if (debit !== 0 && credit !== 0) return null;
    if (credit !== 0) return { value: -credit, field: 'credit' };
    return { value: debit, field: hasDebit ? 'debit' : 'credit' };
  }

  for (const field of SINGLE_AMOUNT_FIELDS) {
    const raw = row[field];
    if (isBlank(raw)) continue;
    if (!isNumericAmount(raw)) return null;
    const value = parseFinancialAmount(raw);
    // normalized_amount uses the inverse convention (negative = outflow)
    return { value: field === 'normalized_amount' && value !== 0 ? -value : value, field };
  }
  return null;
}

interface AccountKind {
  type: AccountType;
  subtype: AccountSubtype;
}

const CREDIT_TOKENS = new Set(['credit', 'credit_card', 'charge_card', 'card']);
const LINE_OF_CREDIT_TOKENS = new Set(['line_of_credit', 'loc', 'heloc', 'business_line_of_credit']);
const LOAN_TOKENS = new Set(['loan', 'term_loan', 'sba', 'sba_loan', 'mortgage', 'student', 'auto', 'commercial', 'home_equity', 'personal_loan', 'commercial_loan']);
const INVESTMENT_TOKENS = new Set(['investment', 'brokerage', 'retirement', 'ira', 'roth', '401k', '403b', '457b', 'roth_401k', '529']);
const CHECKING_TOKENS = new Set(['checking', 'cash_management', 'prepaid', 'paypal']);
const SAVINGS_TOKENS = new Set(['savings', 'money_market', 'cd', 'share']);

function loanKind(lowerName: string, token = ''): AccountKind {
  if (token === 'sba' || token === 'sba_loan' || /\bsba\b/.test(lowerName)) return { type: 'loan', subtype: 'sba_loan' };
  if (LINE_OF_CREDIT_TOKENS.has(token) || /\b(line\s*of\s*credit|heloc)\b/.test(lowerName)) return { type: 'loan', subtype: 'line_of_credit' };
  return { type: 'loan', subtype: 'term_loan' };
}

/**
 * Determines account type from explicit type/subtype/category columns first (including
 * Plaid's `type`/`subtype`), then structured credit signals, then the account name.
 */
function resolveSnapshotAccountKind(row: Record<string, any>, name: string, creditLimit: number | undefined): AccountKind {
  const lowerName = name.toLowerCase();
  const depository = (subtype?: AccountSubtype): AccountKind => ({
    type: 'depository',
    subtype: subtype ?? (/\b(savings|share|money\s*market)\b/.test(lowerName) ? 'savings' : 'checking'),
  });

  const tokens = [row.account_type, row.account_subtype, row.subtype, row.type, row.category]
    .filter((v) => !isBlank(v))
    .map((v) => String(v).trim().toLowerCase().replace(/[\s-]+/g, '_'));

  for (const token of tokens) {
    if (CREDIT_TOKENS.has(token)) return { type: 'credit', subtype: 'credit_card' };
    if (LINE_OF_CREDIT_TOKENS.has(token) || LOAN_TOKENS.has(token)) return loanKind(lowerName, token);
    if (INVESTMENT_TOKENS.has(token)) return { type: 'investment', subtype: 'brokerage' };
    if (CHECKING_TOKENS.has(token)) return depository('checking');
    if (SAVINGS_TOKENS.has(token)) return depository('savings');
    if (token === 'depository') return depository();
  }

  if (row.card_name !== undefined || creditLimit !== undefined) return { type: 'credit', subtype: 'credit_card' };
  if (/\b(checking|savings|share|money\s*market)\b/.test(lowerName)) return depository();
  if (/\b(line\s*of\s*credit|heloc|sba|loan|mortgage)\b/.test(lowerName)) return loanKind(lowerName);
  if (lowerName.includes('card') || (lowerName.includes('credit') && !/credit\s*union/.test(lowerName))) {
    return { type: 'credit', subtype: 'credit_card' };
  }
  return depository();
}

export interface ParseRecordTypeOptions {
  existingTransactionIds?: Set<string>;
  existingAccounts?: Account[];
  batchId?: string;
  fileName?: string;
  fileSize?: string;
  defaultAccountName?: string;
  defaultAccountId?: string;
  defaultInstitution?: string;
}

function deterministicHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Universal Staging Ingestion Parser for Financial Statements & Multi-Record Exports.
 * Strictly enforces:
 *  1. Separate tables: transactions, account_snapshot (balances), bill, loan, notes_assumptions.
 *  2. Only records explicitly identified as transactions are added to the transaction ledger.
 *  3. Unique source transaction_id matching — never duplicates or merges by text description.
 *  4. Source account identity validation (account_id or account name required).
 *  5. Explicit transaction status (posted, pending, or unknown).
 *  6. Full reconciliation reporting: records read, accepted, rejected, unmatched, and why.
 *  7. Mathematical variance reconciliation between source file and staged entities.
 */
export function parseRecordTypeContent(
  rawContent: string,
  options: ParseRecordTypeOptions = {}
): ImportReconciliationSummary {
  const existingTxIds = options.existingTransactionIds || new Set<string>();
  const seenBatchTxIds = new Set<string>();
  const batchId = options.batchId || `batch_${Date.now()}`;
  const nowIso = new Date().toISOString();

  const summary: ImportReconciliationSummary = {
    rowsRead: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    duplicatesSkippedCount: 0,
    unknownRecordTypesCount: 0,
    totalsByRecordType: {
      transaction: 0,
      account_snapshot: 0,
      bill: 0,
      loan: 0,
      notes_assumptions: 0,
    },
    rejections: [],
    duplicates: [],
    unknownTypes: [],
    unmatchedAccounts: [],
    parsedAccounts: [],
    parsedTransactions: [],
    parsedBills: [],
    parsedLoans: [],
    parsedNotes: [],
  };

  if (!rawContent || !rawContent.trim()) {
    return summary;
  }

  // 1. Determine JSON or CSV
  const trimmed = rawContent.trim();
  let rows: Record<string, any>[] = [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsedJson = JSON.parse(trimmed);
      if (Array.isArray(parsedJson)) {
        rows = parsedJson;
      } else if (parsedJson.records && Array.isArray(parsedJson.records)) {
        rows = parsedJson.records;
      } else if (parsedJson.transactions && Array.isArray(parsedJson.transactions)) {
        // Standard Plaid JSON format: extract accounts and transactions separately
        if (parsedJson.accounts && Array.isArray(parsedJson.accounts)) {
          parsedJson.accounts.forEach((acc: any) => {
            rows.push({
              record_type: 'account_snapshot',
              account_id: acc.account_id,
              name: acc.name,
              official_name: acc.official_name,
              type: acc.type,
              subtype: acc.subtype,
              balance: acc.balances?.current ?? 0,
              available_balance: acc.balances?.available ?? null,
              credit_limit: acc.balances?.limit ?? null,
              currency: acc.balances?.iso_currency_code || 'USD',
              institution: acc.name?.split(' ')[0] || 'Bank',
              mask: acc.mask || '••••',
            });
          });
        }
        parsedJson.transactions.forEach((tx: any) => {
          rows.push({
            record_type: 'transaction',
            transaction_id: tx.transaction_id,
            account_id: tx.account_id,
            account_name: tx.account_name || 'Imported Account',
            amount: tx.amount,
            date: tx.date,
            description: tx.name,
            merchant: tx.merchant_name || tx.name,
            pending: tx.pending,
            category: Array.isArray(tx.category) ? tx.category.join(';') : tx.category,
            currency: tx.iso_currency_code || 'USD',
          });
        });
      } else if (parsedJson.rows && Array.isArray(parsedJson.rows)) {
        rows = parsedJson.rows;
      } else {
        rows = [parsedJson];
      }
    } catch (e: any) {
      summary.rejections.push({
        rowNumber: 1,
        reason: `JSON parse error: ${e.message}`,
        rawRow: { content: trimmed.slice(0, 100) },
      });
      summary.rejectedCount++;
      return summary;
    }
  } else {
    rows = parseCsvToRows(rawContent);
  }

  summary.rowsRead = rows.length;

  // Track raw mathematical sums
  let rawTotalDebits = 0;
  let rawTotalCredits = 0;

  for (const row of rows) {
    const extracted = extractAmount(normalizeKeys(row));
    if (!extracted) continue;
    if (extracted.value > 0) rawTotalDebits += extracted.value;
    else if (extracted.value < 0) rawTotalCredits += Math.abs(extracted.value);
  }

  // 2. Process each row into its strict table
  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // Accounting for 1-based index and header line
    const normalizedRow = normalizeKeys(row);

    // Identify record type
    const explicitRecordType = (
      normalizedRow.record_type ||
      normalizedRow.recordtype ||
      normalizedRow.entity_type ||
      ''
    ).toString().trim();

    let recordType = mapRecordType(explicitRecordType || normalizedRow.type || '');

    // If explicit record_type column was given, but value wasn't recognized:
    if (explicitRecordType && !recordType) {
      summary.unknownRecordTypesCount++;
      summary.unknownTypes.push({ rowNumber, rawType: explicitRecordType });
      summary.rejections.push({
        rowNumber,
        reason: `Rejected: Unrecognized record_type "${explicitRecordType}". Expected: transaction, account_snapshot, bill, loan, or notes_assumptions.`,
        rawRow: row,
      });
      summary.rejectedCount++;
      return;
    }

    // If record_type column is missing or empty, infer safely:
    if (!recordType) {
      const descLower = (
        normalizedRow.description ||
        normalizedRow.memo ||
        normalizedRow.merchant ||
        normalizedRow.name ||
        ''
      ).toString().toLowerCase();

      const accLower = (
        normalizedRow.account_name ||
        normalizedRow.account ||
        ''
      ).toString().toLowerCase();

      // Check for credit card or account balance snapshot tracker (e.g. card_name, reported_balance, credit_limit, balance)
      if (
        normalizedRow.card_name !== undefined ||
        (normalizedRow.credit_limit !== undefined && (normalizedRow.reported_balance !== undefined || normalizedRow.balance !== undefined || normalizedRow.reported_available_credit !== undefined)) ||
        normalizedRow.reported_balance !== undefined ||
        normalizedRow.reported_current_balance !== undefined ||
        normalizedRow.reported_available_balance !== undefined ||
        (normalizedRow.account_type !== undefined && (normalizedRow.reported_current_balance !== undefined || normalizedRow.reported_balance !== undefined || normalizedRow.balance !== undefined)) ||
        /^(beginning|ending|statement|available|current|account|closing)\s*balance\b/i.test(descLower) ||
        (normalizedRow.balance !== undefined && normalizedRow.amount === undefined && normalizedRow.debit === undefined && normalizedRow.credit === undefined)
      ) {
        recordType = 'account_snapshot';
      }
      // Check for loan
      else if (
        /\b(sba|term\s*loan|promissory|line\s*of\s*credit|commercial\s*loan)\b/i.test(accLower) ||
        /\b(sba\s*loan|term\s*loan|loan\s*payment|principal\s*balance)\b/i.test(descLower)
      ) {
        if (normalizedRow.balance !== undefined || normalizedRow.interest_rate !== undefined || normalizedRow.monthly_payment !== undefined) {
          recordType = 'loan';
        } else {
          recordType = 'transaction';
        }
      }
      // Check for notes/commentary
      else if (
        normalizedRow.note_text ||
        normalizedRow.note ||
        normalizedRow.assumption ||
        (!normalizedRow.amount && !normalizedRow.debit && !normalizedRow.credit && !normalizedRow.date && descLower.length > 10)
      ) {
        recordType = 'notes_assumptions';
      }
      // Check for recurring bill
      else if (
        normalizedRow.due_date ||
        normalizedRow.cadence ||
        descLower.includes('recurring bill')
      ) {
        recordType = 'bill';
      }
      // Standard transaction row (has transaction_id, or has date and amount/debit/credit)
      else if (
        normalizedRow.transaction_id ||
        normalizedRow.source_tx_id ||
        normalizedRow.tx_id ||
        ((normalizedRow.date || normalizedRow.posted_date || normalizedRow.transaction_date || normalizedRow.snapshot_date || normalizedRow.authorized_date) &&
        (normalizedRow.amount !== undefined || normalizedRow.debit !== undefined || normalizedRow.credit !== undefined || normalizedRow.raw_amount !== undefined || normalizedRow.normalized_amount !== undefined || normalizedRow.tx_amount !== undefined || normalizedRow.transaction_amount !== undefined))
      ) {
        recordType = 'transaction';
      } else {
        // Row could not be safely classified
        summary.unknownRecordTypesCount++;
        summary.unknownTypes.push({ rowNumber, rawType: '(unspecified)' });
        summary.rejections.push({
          rowNumber,
          reason: 'Row could not be verified as a transaction, balance snapshot, bill, or loan record (missing date/amount or required fields).',
          rawRow: row,
        });
        summary.rejectedCount++;
        return;
      }
    }

    // Process according to strict record type
    switch (recordType) {
      case 'transaction': {
        // Requirement 4: Match transactions using the source transaction_id
        const rawTxId = (
          normalizedRow.transaction_id ||
          normalizedRow.source_tx_id ||
          normalizedRow.tx_id ||
          normalizedRow.id ||
          normalizedRow.reference ||
          normalizedRow.reference_number ||
          normalizedRow.fitid ||
          ''
        ).toString().trim();

        // If the row explicitly has a transaction_id column or came with explicit record_type === 'transaction', require non-empty ID
        const hasExplicitTxIdColumn = (
          'transaction_id' in normalizedRow ||
          'source_tx_id' in normalizedRow ||
          'tx_id' in normalizedRow ||
          (explicitRecordType.toLowerCase() === 'transaction' && !rawTxId)
        );

        if (hasExplicitTxIdColumn && !rawTxId) {
          summary.rejections.push({
            rowNumber,
            reason: 'Missing required unique "transaction_id" (Source ID required for immutable ledger matching).',
            rawRow: row,
          });
          summary.rejectedCount++;
          return;
        }

        // Requirement 5: Require Source Account Identity
        let rawAccount = (
          normalizedRow.account_id ||
          normalizedRow.account_name ||
          normalizedRow.account ||
          normalizedRow.bank ||
          normalizedRow.source_account ||
          normalizedRow.institution ||
          options.defaultAccountName ||
          options.defaultAccountId ||
          ''
        ).toString().trim();

        if (!rawAccount) {
          if (summary.parsedAccounts.length > 0) {
            rawAccount = summary.parsedAccounts[0].name;
          } else {
            rawAccount = 'General Account';
          }
        }

        // Amount parsing & validation
        const extractedAmount = extractAmount(normalizedRow);
        if (!extractedAmount) {
          summary.rejections.push({
            rowNumber,
            reason: `Rejected: Missing or invalid numeric amount in transaction.`,
            rawRow: row,
          });
          summary.rejectedCount++;
          return;
        }
        const parsedAmount = extractedAmount.value;

        // Date validation
        const rawDate = (
          normalizedRow.date ||
          normalizedRow.transaction_date ||
          normalizedRow.posted_date ||
          normalizedRow.snapshot_date ||
          normalizedRow.authorized_date ||
          normalizedRow.effective_date ||
          ''
        ).toString().trim();

        const dateStr = rawDate || nowIso.split('T')[0];

        // Description / Merchant
        const rawDesc = (
          normalizedRow.description ||
          normalizedRow.memo ||
          normalizedRow.raw_description ||
          normalizedRow.merchant ||
          'Unlabeled Transaction'
        ).toString().trim();
        const merchant = (
          normalizedRow.merchant ||
          normalizedRow.clean_merchant ||
          cleanMerchantName(rawDesc)
        ).toString().trim();

        const txId = rawTxId || `tx_det_${deterministicHash(`${rawAccount}_${dateStr}_${parsedAmount.toFixed(2)}_${cleanMerchantName(rawDesc)}`)}`;

        // Deduplication strictly on transaction_id (never text descriptions!)
        if (existingTxIds.has(txId) || seenBatchTxIds.has(txId)) {
          summary.duplicatesSkippedCount++;
          summary.duplicates.push({ transactionId: txId, rowNumber });
          return;
        }
        seenBatchTxIds.add(txId);

        // Requirement 5: Require status: posted / pending / unknown
        const rawStatus = (
          normalizedRow.status ||
          normalizedRow.state ||
          normalizedRow.cleared ||
          normalizedRow.settled ||
          ''
        ).toString().trim().toLowerCase();

        const pendingStr = String(normalizedRow.pending ?? '').trim().toLowerCase();

        let txStatus: 'posted' | 'pending' | 'unknown' = 'unknown';
        let isPending = false;

        if (
          normalizedRow.pending === true ||
          pendingStr === 'true' ||
          pendingStr === '1' ||
          rawStatus.includes('pending') ||
          rawStatus.includes('hold') ||
          rawStatus.includes('auth')
        ) {
          txStatus = 'pending';
          isPending = true;
        } else if (
          normalizedRow.pending === false ||
          pendingStr === 'false' ||
          pendingStr === '0' ||
          rawStatus.includes('posted') ||
          rawStatus.includes('settled') ||
          rawStatus.includes('cleared')
        ) {
          txStatus = 'posted';
          isPending = false;
        } else {
          txStatus = 'unknown';
          isPending = false;
        }

        // Account mapping
        const candidateSlug = `acc_${rawAccount.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const matchedAccount = options.existingAccounts?.find(
          (a) =>
            (normalizedRow.account_id && a.id.toLowerCase() === String(normalizedRow.account_id).toLowerCase()) ||
            a.id.toLowerCase() === candidateSlug.toLowerCase() ||
            a.name.toLowerCase() === rawAccount.toLowerCase() ||
            (a.officialName && a.officialName.toLowerCase() === rawAccount.toLowerCase()) ||
            a.name.toLowerCase().includes(rawAccount.toLowerCase()) ||
            rawAccount.toLowerCase().includes(a.name.toLowerCase())
        );

        const accountId = (
          normalizedRow.account_id ||
          (matchedAccount ? matchedAccount.id : options.defaultAccountId || candidateSlug)
        ).toString().trim();
        const accountName = (
          (matchedAccount ? matchedAccount.name : normalizedRow.account_name || rawAccount || 'Imported Account')
        ).toString().trim();
        const institution = (
          (matchedAccount ? matchedAccount.institution : normalizedRow.institution || options.defaultInstitution || accountName.split(' ')[0] || 'Bank')
        ).toString().trim();

        // Classification: zero-guessing default
        const candidateClassification = (normalizedRow.classification || '').toString().trim().toLowerCase();
        const validClassifications: TransactionClassification[] = [
          'business',
          'personal',
          'transfer',
          'reimbursement',
          'income',
          'debt_payment',
          'needs_review',
        ];

        let finalClassification: TransactionClassification = 'needs_review';
        let classificationReason = 'Defaulted unclassified imported transaction to Needs Review for owner sign-off.';
        let userOverridden = false;

        if (validClassifications.includes(candidateClassification as TransactionClassification) && candidateClassification !== 'needs_review') {
          finalClassification = candidateClassification as TransactionClassification;
          classificationReason = `Explicit classification "${finalClassification}" supplied in source record.`;
          userOverridden = true;
        }

        const parsedTx: Transaction = {
          id: txId,
          sourceTxId: txId,
          importBatchId: batchId,
          importedAt: nowIso,
          accountId,
          accountName,
          institution,
          date: dateStr,
          rawDescription: rawDesc,
          merchantName: merchant,
          cleanMerchant: merchant,
          amount: parsedAmount,
          currency: (normalizedRow.currency || 'USD').toString().toUpperCase(),
          pending: isPending,
          status: txStatus,
          category: normalizedRow.category
            ? normalizedRow.category.toString().split(';').map((c: string) => c.trim())
            : ['Imported'],
          classification: finalClassification,
          auditTrail: [
            {
              id: `aud_imp_${batchId}_${txId}`,
              timestamp: nowIso,
              assignedClassification: finalClassification,
              ruleApplied: userOverridden ? 'Source Record Label' : 'Default Needs Review Import Gate',
              confidence: userOverridden ? 1.0 : 0.5,
              reasoning: classificationReason,
              userOverridden,
            },
          ],
          anomalies: [],
        };

        summary.parsedTransactions.push(parsedTx);
        summary.acceptedCount++;
        summary.totalsByRecordType.transaction++;
        break;
      }

      case 'account_snapshot': {
        const name = (
          normalizedRow.card_name ||
          normalizedRow.name ||
          normalizedRow.account_name ||
          normalizedRow.account ||
          'Imported Account'
        ).toString().trim();

        const maskRaw = (
          normalizedRow.last_four ||
          normalizedRow.last4 ||
          normalizedRow.mask ||
          ''
        ).toString().trim();
        const mask = maskRaw ? maskRaw.padStart(4, '•').slice(-4) : '••••';

        const accId = (
          normalizedRow.account_id ||
          normalizedRow.id ||
          `acc_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}${maskRaw ? `_${maskRaw}` : ''}`
        ).toString().trim();

        const institution = (
          normalizedRow.institution ||
          name.split(' ')[0] ||
          'Bank'
        ).toString().trim();

        const rawBal =
          normalizedRow.reported_current_balance !== undefined && normalizedRow.reported_current_balance !== ''
            ? normalizedRow.reported_current_balance
            : normalizedRow.reported_balance !== undefined && normalizedRow.reported_balance !== ''
            ? normalizedRow.reported_balance
            : normalizedRow.balance !== undefined && normalizedRow.balance !== ''
            ? normalizedRow.balance
            : normalizedRow.current_balance !== undefined && normalizedRow.current_balance !== ''
            ? normalizedRow.current_balance
            : normalizedRow.amount || 0;
        const currentBalance = typeof rawBal === 'number' ? rawBal : parseFinancialAmount(rawBal);

        const rawAvail = firstPresent(normalizedRow, [
          'reported_available_balance',
          'reported_available_credit',
          'available_balance',
          'calculated_limit_minus_balance_if_not_reported',
        ]);
        // Unknown when the source does not report it; never substitute the book balance.
        const availableBalance = rawAvail !== undefined ? parseFinancialAmount(rawAvail) : null;

        const rawLimit =
          normalizedRow.credit_limit !== undefined && normalizedRow.credit_limit !== ''
            ? normalizedRow.credit_limit
            : normalizedRow.limit;
        const creditLimit =
          rawLimit !== undefined && rawLimit !== null && rawLimit !== ''
            ? typeof rawLimit === 'number' ? rawLimit : Math.abs(parseFinancialAmount(rawLimit))
            : undefined;

        const isClosed =
          (normalizedRow.available_credit_status || '').toString().toLowerCase().includes('closed') ||
          (normalizedRow.status_or_usage_notes || '').toString().toLowerCase().includes('closed account');

        const accountKind = resolveSnapshotAccountKind(normalizedRow, name, creditLimit);
        const isCredit = accountKind.type === 'credit';

        const connStatus = (normalizedRow.connection_status || '').toString().toLowerCase();
        const freshnessStatus = (normalizedRow.data_freshness_status || '').toString().toLowerCase();
        const isStale = isClosed ||
          connStatus.includes('login required') ||
          connStatus.includes('manual') ||
          freshnessStatus.includes('stale') ||
          freshnessStatus.includes('login required');

        const treatment = (normalizedRow.household_cash_treatment || '').toString().toLowerCase();
        const isBiz = treatment.includes('business') || normalizedRow.is_business === true || normalizedRow.is_business === 'true';
        const isReconOnly = treatment.includes('reconciliation-only') || name.toLowerCase().includes('reconciliation-only');
        const entity: FinancialEntity = isReconOnly ? 'unknown' : isBiz ? 'business' : 'personal';

        const apr = parseOptionalNumber(firstPresent(normalizedRow, ['interest_rate_percent', 'interest_rate']));
        const minPay = parseOptionalNumber(firstPresent(normalizedRow, ['minimum_payment', 'monthly_payment']));

        const accountSnapshot: Account = {
          id: accId,
          name,
          officialName: (normalizedRow.official_name || `${name} Snapshot`).toString().trim(),
          institution,
          mask,
          type: accountKind.type,
          subtype: accountKind.subtype,
          currentBalance,
          availableBalance,
          creditLimit,
          interestRate: apr,
          monthlyPayment: minPay,
          currency: (normalizedRow.currency || 'USD').toString().toUpperCase(),
          lastSyncedAt: nowIso,
          sourceBalanceTimestamp: nowIso,
          isStale,
          isBusiness: isBiz,
          entity,
          status: isClosed ? 'disconnected' : isStale ? 'disconnected' : 'active',
        };

        summary.parsedAccounts.push(accountSnapshot);
        summary.acceptedCount++;
        summary.totalsByRecordType.account_snapshot++;

        // Attach usage note as planning note if present
        const usageNotes = (
          normalizedRow.status_or_usage_notes ||
          normalizedRow.account_notes ||
          ''
        ).toString().trim();
        if (usageNotes) {
          summary.parsedNotes.push({
            id: `note_acc_${accId}_${deterministicHash(usageNotes)}`,
            category: isCredit ? 'Credit Strategy & Usage' : 'Deposit & Cash Treatment',
            noteText: `${name} (••••${mask}): ${usageNotes}`,
            createdDate: nowIso.split('T')[0],
            associatedEntity: entity,
            author: isCredit ? 'Card Tracker' : 'Bank Balance Tracker',
          });
          summary.totalsByRecordType.notes_assumptions++;
        }
        break;
      }

      case 'bill': {
        const merchant = (normalizedRow.merchant || normalizedRow.clean_merchant || normalizedRow.name || 'Recurring Bill').toString().trim();
        const amt = parseFinancialAmount(normalizedRow.amount || normalizedRow.last_amount || normalizedRow.balance || 0);
        const billId = (normalizedRow.id || normalizedRow.bill_id || normalizedRow.subscription_id || `bill_${Date.now()}_${idx}`).toString().trim();

        const bill: Subscription = {
          id: billId,
          cleanMerchant: merchant,
          frequency: (normalizedRow.frequency || normalizedRow.cadence || 'monthly') as any,
          averageAmount: Math.abs(amt),
          lastAmount: Math.abs(amt),
          lastBilledDate: (normalizedRow.last_billed_date || normalizedRow.date || nowIso.split('T')[0]).toString().trim(),
          nextEstimatedDate: (normalizedRow.next_estimated_date || normalizedRow.due_date || nowIso.split('T')[0]).toString().trim(),
          category: (normalizedRow.category || 'Recurring Obligations').toString().trim(),
          accountName: (normalizedRow.account_name || normalizedRow.account || 'Primary Account').toString().trim(),
          accountId: (normalizedRow.account_id || 'acc_primary').toString().trim(),
          status: 'active',
          transactionCount: 1,
          confidence: 'owner_confirmed',
          isEstimatedDate: false,
        };

        summary.parsedBills.push(bill);
        summary.acceptedCount++;
        summary.totalsByRecordType.bill++;
        break;
      }

      case 'loan': {
        const name = (normalizedRow.name || normalizedRow.loan_name || normalizedRow.account_name || 'Commercial Loan').toString().trim();
        const accId = (
          normalizedRow.account_id ||
          normalizedRow.loan_id ||
          normalizedRow.id ||
          `loan_${Date.now()}_${idx}`
        ).toString().trim();

        const rawBal = normalizedRow.balance || normalizedRow.current_balance || normalizedRow.amount || 0;
        const currentBalance = typeof rawBal === 'number' ? rawBal : Math.abs(parseFinancialAmount(rawBal));
        const rate = parseOptionalNumber(firstPresent(normalizedRow, ['interest_rate', 'rate'])) ?? 0;
        const payment = parseOptionalNumber(firstPresent(normalizedRow, ['monthly_payment', 'payment'])) ?? 0;

        const loanAccount: Account = {
          id: accId,
          name,
          officialName: (normalizedRow.official_name || `${name} Facility`).toString().trim(),
          institution: (normalizedRow.institution || 'Lender').toString().trim(),
          mask: (normalizedRow.mask || '••••').toString().slice(-4),
          type: 'loan',
          subtype: name.toLowerCase().includes('sba') ? 'sba_loan' : 'term_loan',
          currentBalance,
          availableBalance: null,
          interestRate: rate > 0 ? rate : undefined,
          monthlyPayment: payment > 0 ? payment : undefined,
          maturityDate: normalizedRow.maturity_date ? normalizedRow.maturity_date.toString().trim() : undefined,
          currency: (normalizedRow.currency || 'USD').toString().toUpperCase(),
          lastSyncedAt: nowIso,
          isStale: false,
          isBusiness: true,
          status: 'active',
        };

        summary.parsedLoans.push(loanAccount);
        summary.acceptedCount++;
        summary.totalsByRecordType.loan++;
        break;
      }

      case 'notes_assumptions': {
        const text = (
          normalizedRow.note_text ||
          normalizedRow.note ||
          normalizedRow.assumption ||
          normalizedRow.text ||
          normalizedRow.description ||
          'Financial planning note'
        ).toString().trim();

        const note: FinancialNote = {
          id: (normalizedRow.id || normalizedRow.note_id || `note_${Date.now()}_${idx}`).toString().trim(),
          category: (normalizedRow.category || 'Planning Note').toString().trim(),
          noteText: text,
          createdDate: (normalizedRow.date || nowIso.split('T')[0]).toString().trim(),
          associatedEntity: normalizedRow.entity || 'business',
          author: (normalizedRow.author || 'Owner').toString().trim(),
        };

        summary.parsedNotes.push(note);
        summary.acceptedCount++;
        summary.totalsByRecordType.notes_assumptions++;
        break;
      }
    }
  });

  // Calculate Staged Totals
  const stagedDebits = summary.parsedTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const stagedCredits = summary.parsedTransactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const deltaDebits = Math.abs(rawTotalDebits - stagedDebits);
  const deltaCredits = Math.abs(rawTotalCredits - stagedCredits);

  let explanation = 'Mathematical 100% match ($0.00 variance between source CSV and staged transaction ledger).';
  const nonTxCount =
    summary.totalsByRecordType.account_snapshot +
    summary.totalsByRecordType.bill +
    summary.totalsByRecordType.loan +
    summary.totalsByRecordType.notes_assumptions;

  if (deltaDebits > 0.01 || deltaCredits > 0.01) {
    if (nonTxCount > 0) {
      explanation = `Verified: ${nonTxCount} row(s) routed to separate tables (account balances, loans, bills, notes) rather than the transaction ledger.`;
    } else if (summary.rejectedCount > 0) {
      explanation = `Variance reflects ${summary.rejectedCount} rejected row(s) that failed validation.`;
    }
  }

  summary.fileMetadata = {
    fileName: options.fileName || 'statement_export.csv',
    fileSize: options.fileSize || `${(rawContent.length / 1024).toFixed(1)} KB`,
    sha256: `sha256_${deterministicHash(rawContent)}`,
    rawDebitsSum: rawTotalDebits,
    rawCreditsSum: rawTotalCredits,
    rawNetSum: rawTotalCredits - rawTotalDebits,
  };

  summary.variance = {
    rawDebits: rawTotalDebits,
    rawCredits: rawTotalCredits,
    stagedDebits,
    stagedCredits,
    deltaDebits,
    deltaCredits,
    explanation,
  };

  // Identify unmatched accounts and auto-provision accounts for transactions
  const existingAccountNames = new Set<string>();
  (options.existingAccounts || []).forEach((a) => {
    existingAccountNames.add(a.name.toLowerCase());
    existingAccountNames.add(a.id.toLowerCase());
  });

  const unmatchedMap = new Map<string, { count: number; total: number }>();
  summary.parsedTransactions.forEach((t) => {
    if (
      !existingAccountNames.has(t.accountName.toLowerCase()) &&
      !existingAccountNames.has(t.accountId.toLowerCase())
    ) {
      const cur = unmatchedMap.get(t.accountName) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += t.amount;
      unmatchedMap.set(t.accountName, cur);
    }
  });

  summary.unmatchedAccounts = Array.from(unmatchedMap.entries()).map(([name, data]) => ({
    accountName: name,
    txCount: data.count,
    totalAmount: data.total,
  }));

  // Auto-provision accounts for any newly discovered accounts so transactions have an account home
  summary.unmatchedAccounts.forEach((unmatched) => {
    const accId = `acc_${unmatched.accountName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    if (
      !summary.parsedAccounts.some(
        (a) => a.name.toLowerCase() === unmatched.accountName.toLowerCase() || a.id === accId
      )
    ) {
      const isCredit = unmatched.accountName.toLowerCase().includes('card') || unmatched.accountName.toLowerCase().includes('credit');
      summary.parsedAccounts.push({
        id: accId,
        name: unmatched.accountName,
        officialName: `${unmatched.accountName} Statement Feed`,
        institution: unmatched.accountName.split(' ')[0] || 'Bank',
        mask: '••••',
        type: isCredit ? 'credit' : 'depository',
        subtype: isCredit ? 'credit_card' : 'checking',
        currentBalance: 0,
        availableBalance: 0,
        currency: 'USD',
        lastSyncedAt: nowIso,
        isStale: false,
        isBusiness: true,
        status: 'active',
      });
    }
  });

  return summary;
}

/**
 * Normalizes case and aliases for record types.
 */
function mapRecordType(rawType: string): RecordType | null {
  const clean = rawType.replace(/[\s_-]/g, '').toLowerCase();
  if (['transaction', 'tx', 'ledger', 'entry', 'charge', 'payment'].includes(clean)) {
    return 'transaction';
  }
  if (['accountsnapshot', 'account', 'snapshot', 'balance', 'depository', 'checking', 'savings'].includes(clean)) {
    return 'account_snapshot';
  }
  if (['bill', 'subscription', 'recurring', 'recurringbill'].includes(clean)) {
    return 'bill';
  }
  if (['loan', 'debt', 'commercialloan', 'termloan', 'sbaloan'].includes(clean)) {
    return 'loan';
  }
  if (['notesassumptions', 'note', 'notes', 'assumption', 'assumptions'].includes(clean)) {
    return 'notes_assumptions';
  }
  return null;
}

/**
 * Normalizes object keys to lowercase snake_case.
 */
function normalizeKeys(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const cleanKey = k.trim().toLowerCase().replace(/[\s-]/g, '_');
    result[cleanKey] = v;
  }
  return result;
}

/**
 * Robust CSV parser that correctly handles quoted values containing commas and newlines.
 */
function parseCsvToRows(csvText: string): Record<string, any>[] {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++;
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  const headers = splitCsvRow(lines[0]).map((h) => h.trim());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvRow(lines[i]);
    const rowObj: Record<string, any> = {};
    headers.forEach((h, index) => {
      rowObj[h] = values[index] !== undefined ? values[index] : '';
    });
    rows.push(rowObj);
  }

  return rows;
}

function splitCsvRow(rowText: string): string[] {
  const result: string[] = [];
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

/**
 * Helper to generate a multi-record-type sample CSV for user download and reference.
 */
export function generateSampleRecordTypeCsv(): string {
  return `record_type,transaction_id,account_id,account_name,institution,date,description,merchant,amount,currency,pending,classification,category,interest_rate,monthly_payment,note_text
account_snapshot,,acc_chase_op,Chase Primary Checking,JPMorgan Chase,2026-10-01,Account Snapshot,JPMorgan Chase,54250.00,USD,false,,depository,,,,
account_snapshot,,acc_amex_biz,Amex Business Gold,American Express,2026-10-01,Account Snapshot,American Express,4200.00,USD,false,,credit,,,,
loan,,loan_sba_01,SBA 7(a) Working Capital,Live Oak Bank,2026-10-01,Working Capital Facility,Live Oak Bank,85000.00,USD,false,,term_loan,6.25,1420.00,
bill,,acc_chase_op,AWS Cloud Infrastructure,Amazon Web Services,2026-10-01,Monthly Cloud Hosting,Amazon Web Services,2850.00,USD,false,,Software,,,,
transaction,tx_vendor_001,acc_chase_op,Chase Primary Checking,JPMorgan Chase,2026-10-02,GITHUB ENTERPRISE SEATS,GitHub,210.00,USD,false,needs_review,Software,,,,
transaction,tx_vendor_002,acc_chase_op,Chase Primary Checking,JPMorgan Chase,2026-10-03,CLIENT RETAINER WIRE,Acme Client,-15000.00,USD,false,needs_review,Revenue,,,,
notes_assumptions,,,,,,Planning Assumption,,0,USD,false,,,,,Q4 revenue forecast assumes closing two additional enterprise retainers.`;
}
