import { describe, it, expect } from 'vitest';
import { reconcileFinancialState } from '../services/reconciliationEngine';
import { rawIngestionStore } from '../services/rawIngestionStore';
import { evaluateDataHealth } from '../services/dataHealthEngine';
import { deriveMetricLineage } from '../services/lineageEngine';
import { Account, Transaction } from '../types';

const BASE_ACCOUNTS: Account[] = [
  {
    id: 'acc_mercury',
    name: 'Mercury Operating',
    officialName: 'Mercury Checking ••9021',
    institution: 'Mercury',
    mask: '9021',
    type: 'depository',
    subtype: 'checking',
    currentBalance: 50000.0,
    availableBalance: 48500.0,
    currency: 'USD',
    lastSyncedAt: new Date().toISOString(),
    isStale: false,
    isBusiness: true,
    status: 'active',
  },
  {
    id: 'acc_chase',
    name: 'Chase Checking',
    officialName: 'Chase Business ••4829',
    institution: 'Chase',
    mask: '4829',
    type: 'depository',
    subtype: 'checking',
    currentBalance: 20000.0,
    availableBalance: 20000.0,
    currency: 'USD',
    lastSyncedAt: new Date().toISOString(),
    isStale: false,
    isBusiness: true,
    status: 'active',
  },
  {
    id: 'acc_amex',
    name: 'Amex Business Card',
    officialName: 'Amex Platinum ••1004',
    institution: 'Amex',
    mask: '1004',
    type: 'credit',
    subtype: 'credit_card',
    currentBalance: 8000.0,
    availableBalance: 17000.0,
    creditLimit: 25000.0,
    currency: 'USD',
    lastSyncedAt: new Date().toISOString(),
    isStale: false,
    isBusiness: true,
    status: 'active',
  },
];

const BASE_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_aws_01',
    accountId: 'acc_amex',
    accountName: 'Amex Business Card',
    institution: 'Amex',
    date: '2026-10-01',
    rawDescription: 'AMAZON WEB SERVICES AWS',
    merchantName: 'AWS',
    cleanMerchant: 'Amazon Web Services',
    amount: 520.0,
    currency: 'USD',
    pending: false,
    category: ['Software & Services'],
    classification: 'business',
    auditTrail: [],
    anomalies: [],
  },
  {
    id: 'tx_pend_dining',
    accountId: 'acc_amex',
    accountName: 'Amex Business Card',
    institution: 'Amex',
    date: '2026-10-02',
    rawDescription: 'THE GRILL BISTRO SF',
    merchantName: 'The Grill Bistro',
    cleanMerchant: 'The Grill Bistro',
    amount: 50.0, // Initial pre-authorization hold
    currency: 'USD',
    pending: true,
    category: ['Food and Drink'],
    classification: 'business',
    auditTrail: [],
    anomalies: [],
  },
];

describe('Rigor Test 1: Ingestion Idempotency (Duplicate Imports)', () => {
  it('producing identical financial state when importing duplicate identical payloads', () => {
    const batch = rawIngestionStore.archivePayload(
      JSON.stringify(BASE_TRANSACTIONS),
      'plaid_json',
      'Test Batch 1'
    );

    // Initial ingestion
    const run1 = reconcileFinancialState(BASE_ACCOUNTS, [], {
      incomingAccounts: BASE_ACCOUNTS,
      incomingTransactions: BASE_TRANSACTIONS,
      rawBatchId: batch.id,
    });

    expect(run1.reconciledTransactions.length).toBe(2);
    expect(run1.report.newTransactions.length).toBe(2);

    // Repeated identical ingestion with same payload
    const run2 = reconcileFinancialState(
      run1.reconciledAccounts,
      run1.reconciledTransactions,
      {
        incomingAccounts: BASE_ACCOUNTS,
        incomingTransactions: BASE_TRANSACTIONS,
        rawBatchId: batch.id,
      }
    );

    // Invariant: zero new transactions, zero modified transactions, total count remains exactly 2
    expect(run2.report.newTransactions.length).toBe(0);
    expect(run2.report.modifiedTransactions.length).toBe(0);
    expect(run2.reconciledTransactions.length).toBe(2);
    expect(run2.reconciledAccounts[0].currentBalance).toBe(BASE_ACCOUNTS[0].currentBalance);
  });
});

describe('Rigor Test 2: Overlapping Imports', () => {
  it('correctly ingests only brand new records from an overlapping delta payload', () => {
    const initialRun = reconcileFinancialState([], [], {
      incomingAccounts: BASE_ACCOUNTS,
      incomingTransactions: BASE_TRANSACTIONS,
      rawBatchId: 'batch_init',
    });

    // Overlapping payload containing 2 existing transactions + 1 brand new transaction
    const newTx: Transaction = {
      id: 'tx_slack_new',
      accountId: 'acc_mercury',
      accountName: 'Mercury Operating',
      institution: 'Mercury',
      date: '2026-10-02',
      rawDescription: 'SLACK TECHNOLOGIES SUB',
      merchantName: 'Slack',
      cleanMerchant: 'Slack Technologies',
      amount: 85.0,
      currency: 'USD',
      pending: false,
      category: ['Software & Services'],
      classification: 'business',
      auditTrail: [],
      anomalies: [],
    };

    const overlappingBatch = [...BASE_TRANSACTIONS, newTx];

    const nextRun = reconcileFinancialState(
      initialRun.reconciledAccounts,
      initialRun.reconciledTransactions,
      {
        incomingAccounts: BASE_ACCOUNTS,
        incomingTransactions: overlappingBatch,
        rawBatchId: 'batch_overlap',
      }
    );

    expect(nextRun.report.newTransactions.length).toBe(1);
    expect(nextRun.report.newTransactions[0].id).toBe('tx_slack_new');
    expect(nextRun.reconciledTransactions.length).toBe(3);
  });
});

describe('Rigor Test 3: Pending-to-Posted Lifecycle with Changed Amounts (Tips)', () => {
  it('promotes pending hold to posted with tip delta without double counting', () => {
    const initialRun = reconcileFinancialState(BASE_ACCOUNTS, BASE_TRANSACTIONS, {
      incomingAccounts: BASE_ACCOUNTS,
      incomingTransactions: BASE_TRANSACTIONS,
      rawBatchId: 'b_init',
    });

    // Incoming posted transaction settled with tip ($50 hold -> $62.50 final)
    const settledTxWithTip: Transaction = {
      id: 'tx_posted_dining_99',
      plaidPendingTransactionId: 'tx_pend_dining', // Plaid pending linkage
      accountId: 'acc_amex',
      accountName: 'Amex Business Card',
      institution: 'Amex',
      date: '2026-10-03',
      rawDescription: 'THE GRILL BISTRO SF #991',
      merchantName: 'The Grill Bistro',
      cleanMerchant: 'The Grill Bistro',
      amount: 62.5, // Tip added
      currency: 'USD',
      pending: false,
      category: ['Food and Drink'],
      classification: 'business',
      auditTrail: [],
      anomalies: [],
    };

    const nextRun = reconcileFinancialState(
      initialRun.reconciledAccounts,
      initialRun.reconciledTransactions,
      {
        incomingAccounts: BASE_ACCOUNTS,
        incomingTransactions: [settledTxWithTip],
        rawBatchId: 'b_settled',
      }
    );

    // Verify reconciliation report records the transition and tip amount delta
    expect(nextRun.report.pendingToPosted.length).toBe(1);
    const promo = nextRun.report.pendingToPosted[0];
    expect(promo.pendingTxId).toBe('tx_pend_dining');
    expect(promo.postedTxId).toBe('tx_posted_dining_99');
    expect(promo.originalHoldAmount).toBe(50.0);
    expect(promo.finalSettledAmount).toBe(62.5);
    expect(promo.amountDelta).toBe(12.5);

    // Verify pending hold was retired from active transactions
    expect(nextRun.reconciledTransactions.some((t) => t.id === 'tx_pend_dining')).toBe(false);
    expect(nextRun.reconciledTransactions.some((t) => t.id === 'tx_posted_dining_99')).toBe(true);
  });
});

describe('Rigor Test 4: Transfers Appearing on Both Accounts', () => {
  it('matches transfer pair across accounts and excludes both legs from P&L', () => {
    const transferOutflow: Transaction = {
      id: 'tx_xfer_out_mercury',
      accountId: 'acc_mercury',
      accountName: 'Mercury Operating',
      institution: 'Mercury',
      date: '2026-10-01',
      rawDescription: 'ONLINE TRANSFER TO CHASE CHECKING',
      merchantName: 'Chase',
      cleanMerchant: 'Chase Bank',
      amount: 7500.0,
      currency: 'USD',
      pending: false,
      category: ['Transfer'],
      classification: 'transfer',
      auditTrail: [],
      anomalies: [],
    };

    const transferInflow: Transaction = {
      id: 'tx_xfer_in_chase',
      accountId: 'acc_chase',
      accountName: 'Chase Checking',
      institution: 'Chase',
      date: '2026-10-02',
      rawDescription: 'ACH CREDIT FROM MERCURY OPERATING',
      merchantName: 'Mercury',
      cleanMerchant: 'Mercury Bank',
      amount: -7500.0,
      currency: 'USD',
      pending: false,
      category: ['Transfer'],
      classification: 'transfer',
      auditTrail: [],
      anomalies: [],
    };

    const result = reconcileFinancialState(BASE_ACCOUNTS, [], {
      incomingAccounts: BASE_ACCOUNTS,
      incomingTransactions: [transferOutflow, transferInflow],
      rawBatchId: 'b_xfer',
    });

    expect(result.report.matchedTransfers.length).toBe(1);
    expect(result.report.matchedTransfers[0].amount).toBe(7500.0);

    const out = result.reconciledTransactions.find((t) => t.id === 'tx_xfer_out_mercury');
    const inc = result.reconciledTransactions.find((t) => t.id === 'tx_xfer_in_chase');

    expect(out?.classification).toBe('transfer');
    expect(inc?.classification).toBe('transfer');
    expect(out?.transferCounterpartId).toBe('tx_xfer_in_chase');
  });
});

describe('Rigor Test 5: Credit Card Payments Appearing on Both Accounts', () => {
  it('pairs credit card bill payment from checking to card and classifies as debt_payment', () => {
    const checkingPmt: Transaction = {
      id: 'tx_pmt_out_mercury',
      accountId: 'acc_mercury',
      accountName: 'Mercury Operating',
      institution: 'Mercury',
      date: '2026-10-01',
      rawDescription: 'AUTOPAY AMEX EPAYMENT ••1004',
      merchantName: 'American Express',
      cleanMerchant: 'American Express',
      amount: 3200.0,
      currency: 'USD',
      pending: false,
      category: ['Payment'],
      classification: 'debt_payment',
      auditTrail: [],
      anomalies: [],
    };

    const cardPmtCredit: Transaction = {
      id: 'tx_pmt_credit_amex',
      accountId: 'acc_amex',
      accountName: 'Amex Business Card',
      institution: 'Amex',
      date: '2026-10-01',
      rawDescription: 'AUTOMATIC PAYMENT - THANK YOU',
      merchantName: 'American Express',
      cleanMerchant: 'American Express',
      amount: -3200.0,
      currency: 'USD',
      pending: false,
      category: ['Payment'],
      classification: 'debt_payment',
      auditTrail: [],
      anomalies: [],
    };

    const result = reconcileFinancialState(BASE_ACCOUNTS, [], {
      incomingAccounts: BASE_ACCOUNTS,
      incomingTransactions: [checkingPmt, cardPmtCredit],
      rawBatchId: 'b_card_pmt',
    });

    expect(result.report.matchedCreditCardPayments.length).toBe(1);
    expect(result.report.matchedCreditCardPayments[0].amount).toBe(3200.0);

    const pmt = result.reconciledTransactions.find((t) => t.id === 'tx_pmt_out_mercury');
    expect(pmt?.classification).toBe('debt_payment');
  });
});

describe('Rigor Test 6: Reversals and Removals', () => {
  it('processes Plaid explicit removals and adjusts ledger', () => {
    const initialRun = reconcileFinancialState(BASE_ACCOUNTS, BASE_TRANSACTIONS, {
      incomingAccounts: BASE_ACCOUNTS,
      incomingTransactions: BASE_TRANSACTIONS,
      rawBatchId: 'b_rev_init',
    });

    expect(initialRun.reconciledTransactions.length).toBe(2);

    // Incoming sync with removedTransactionIds containing the pending dining hold
    const nextRun = reconcileFinancialState(
      initialRun.reconciledAccounts,
      initialRun.reconciledTransactions,
      {
        incomingAccounts: BASE_ACCOUNTS,
        incomingTransactions: [],
        removedTransactionIds: ['tx_pend_dining'],
        rawBatchId: 'b_removed',
      }
    );

    expect(nextRun.report.removedOrReversed.length).toBe(1);
    expect(nextRun.report.removedOrReversed[0].txId).toBe('tx_pend_dining');
    expect(nextRun.reconciledTransactions.length).toBe(1);
    expect(nextRun.reconciledTransactions.some((t) => t.id === 'tx_pend_dining')).toBe(false);
  });
});

describe('Rigor Test 7: Duplicate-Looking Legitimate Purchases', () => {
  it('distinguishes legitimate multi-swipes with distinct transaction IDs', () => {
    const morningUber: Transaction = {
      id: 'tx_uber_morning',
      accountId: 'acc_amex',
      accountName: 'Amex Business Card',
      institution: 'Amex',
      date: '2026-10-02',
      authorizedDate: '2026-10-02T08:30:00Z',
      rawDescription: 'UBER TRIP COMMUTE MORNING',
      merchantName: 'Uber',
      cleanMerchant: 'Uber',
      amount: 24.5,
      currency: 'USD',
      pending: false,
      category: ['Travel'],
      classification: 'business',
      auditTrail: [],
      anomalies: [],
    };

    const eveningUber: Transaction = {
      id: 'tx_uber_evening',
      accountId: 'acc_amex',
      accountName: 'Amex Business Card',
      institution: 'Amex',
      date: '2026-10-02',
      authorizedDate: '2026-10-02T18:45:00Z',
      rawDescription: 'UBER TRIP RETURN EVENING',
      merchantName: 'Uber',
      cleanMerchant: 'Uber',
      amount: 24.5, // Same amount
      currency: 'USD',
      pending: false,
      category: ['Travel'],
      classification: 'business',
      auditTrail: [],
      anomalies: [],
    };

    const result = reconcileFinancialState(BASE_ACCOUNTS, [], {
      incomingAccounts: BASE_ACCOUNTS,
      incomingTransactions: [morningUber, eveningUber],
      rawBatchId: 'b_uber',
    });

    expect(result.reconciledTransactions.length).toBe(2);
    // Neither should be dropped or deleted
    expect(result.reconciledTransactions.some((t) => t.id === 'tx_uber_morning')).toBe(true);
    expect(result.reconciledTransactions.some((t) => t.id === 'tx_uber_evening')).toBe(true);
  });
});

describe('Rigor Test 8: Stale Connections & Missing Feeds', () => {
  it('detects stale connections and missing accounts in subsequent feeds', () => {
    const staleAccount: Account = {
      ...BASE_ACCOUNTS[0],
      id: 'acc_sba_stale',
      name: 'SBA 7(a) Term Loan',
      type: 'loan',
      subtype: 'sba_loan',
      lastSyncedAt: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(), // 96h ago
      isStale: true,
      status: 'sync_error',
      staleReason: 'Bank MFA session expired',
    };

    const accountsWithStale = [...BASE_ACCOUNTS, staleAccount];

    // Payload omitting staleAccount to test missing account detection
    const result = reconcileFinancialState(accountsWithStale, [], {
      incomingAccounts: BASE_ACCOUNTS, // Omitting acc_sba_stale
      incomingTransactions: [],
      rawBatchId: 'b_missing',
    });

    expect(result.report.missingAccounts.length).toBe(1);
    expect(result.report.missingAccounts[0].id).toBe('acc_sba_stale');
    // Account should be retained in reconciledAccounts (not wiped out!)
    expect(result.reconciledAccounts.some((a) => a.id === 'acc_sba_stale')).toBe(true);
  });
});

describe('Rigor Test 9: Unavailable Balances & Incomplete Data', () => {
  it('handles nullable available balance and incomplete Plaid fields gracefully', () => {
    const accountWithNullAvailable: Account = {
      id: 'acc_null_bal',
      name: 'Credit Line Account',
      officialName: 'LOC ••0012',
      institution: 'Bank',
      mask: '0012',
      type: 'credit',
      subtype: 'line_of_credit',
      currentBalance: 15000.0,
      availableBalance: null, // Null in Plaid
      currency: 'USD',
      lastSyncedAt: new Date().toISOString(),
      isStale: false,
      isBusiness: true,
      status: 'active',
    };

    const incompleteTx: Transaction = {
      id: 'tx_incomplete_01',
      accountId: 'acc_null_bal',
      accountName: 'Credit Line Account',
      institution: 'Bank',
      date: '2026-10-02',
      rawDescription: 'CHECK #1029 DRAW',
      merchantName: '',
      cleanMerchant: 'Check 1029 Draw',
      amount: 1500.0,
      currency: 'USD',
      pending: false,
      category: [],
      classification: 'needs_review',
      auditTrail: [],
      anomalies: [],
    };

    const result = reconcileFinancialState([accountWithNullAvailable], [], {
      incomingAccounts: [accountWithNullAvailable],
      incomingTransactions: [incompleteTx],
      rawBatchId: 'b_incomplete',
    });

    expect(result.reconciledAccounts[0].availableBalance).toBeNull();
    expect(result.reconciledTransactions[0].classification).toBe('needs_review');

    // Data health evaluation reflects null balance
    const health = evaluateDataHealth(result.reconciledAccounts, result.reconciledTransactions);
    expect(health.unresolvedIssues.some((i) => i.category === 'null_balance')).toBe(true);
  });
});

describe('Rigor Test 10: Strict Zero-Guessing Policy', () => {
  it('quarantines unverified transactions into Needs Review rather than guessing', () => {
    const ambiguousTx: Transaction = {
      id: 'tx_ambiguous_misc',
      accountId: 'acc_mercury',
      accountName: 'Mercury Operating',
      institution: 'Mercury',
      date: '2026-10-02',
      rawDescription: 'POS DEBIT RANDOM UNLISTED VENDOR 9481',
      merchantName: 'Random Unlisted Vendor',
      cleanMerchant: 'Random Unlisted Vendor',
      amount: 340.0,
      currency: 'USD',
      pending: false,
      category: ['Miscellaneous'],
      classification: 'needs_review',
      auditTrail: [],
      anomalies: [],
    };

    const result = reconcileFinancialState(BASE_ACCOUNTS, [], {
      incomingAccounts: BASE_ACCOUNTS,
      incomingTransactions: [ambiguousTx],
      rawBatchId: 'b_ambiguous',
    });

    const tx = result.reconciledTransactions.find((t) => t.id === 'tx_ambiguous_misc')!;
    expect(tx.classification).toBe('needs_review');
    expect(result.report.needsReviewTransactions.length).toBeGreaterThan(0);
    expect(tx.auditTrail[0].reasoning).toContain('Needs Review rather than guessing');
  });
});

describe('Rigor Test 11: Metric Lineage ("Why does this number say $X?")', () => {
  it('derives exact equation and component evidence for True Available Cash', () => {
    const lineage = deriveMetricLineage(
      'true_available_cash',
      BASE_ACCOUNTS,
      BASE_TRANSACTIONS,
      [],
      []
    );

    expect(lineage).not.toBeNull();
    expect(lineage?.metricName).toBe('True Available Cash');
    expect(lineage?.formula).toContain('Depository Book Cash - Pending Outflow Holds');
    expect(lineage?.components.length).toBe(3);

    // Component 1 is Book Balances
    expect(lineage?.components[0].evidence.length).toBe(2); // Mercury + Chase
    // Component 2 is Pending holds
    expect(lineage?.components[1].evidence.length).toBe(1); // $50 hold
  });
});
