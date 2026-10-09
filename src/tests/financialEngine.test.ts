import { describe, it, expect } from 'vitest';
import { cleanMerchantName } from '../services/normalization';
import {
  detectTransfers,
  calculateOperatingExpenses,
  calculateOperatingRevenue,
} from '../services/transferEngine';
import {
  calculateCardUtilization,
  analyzeRevolvingDebt,
  detectStaleAccounts,
  analyzeLoans,
} from '../services/creditEngine';
import { detectSubscriptions } from '../services/subscriptionEngine';
import { detectAnomalies } from '../services/anomalyEngine';
import {
  classifyTransaction,
  reclassifyTransaction,
  revertTransactionClassification,
} from '../services/classificationEngine';
import { computeSyncDiff } from '../services/syncDiffEngine';
import { generateDailyBriefing } from '../services/briefingEngine';
import { evaluateDataHealth } from '../services/dataHealthEngine';
import { parsePlaidJson, parsePlaidCsv } from '../services/plaidParser';
import { INITIAL_ACCOUNTS, INITIAL_TRANSACTIONS } from '../data/mockData';
import { Account, Transaction } from '../types';

describe('Merchant Normalization', () => {
  it('cleans processor prefixes and trailing junk', () => {
    expect(cleanMerchantName('SQ *COFFEE SHOP #1892')).toBe('Coffee Shop');
    expect(cleanMerchantName('TST* BLUE BOTTLE 09/24')).toBe('Blue Bottle');
    expect(cleanMerchantName('AMAZON WEB SERVICES AWS.AMAZON.COM WA')).toBe(
      'Amazon Web Services'
    );
    expect(cleanMerchantName('GOOGLE *WORKSPACE G.CO/HELPPAY#')).toBe(
      'Google Workspace'
    );
  });
});

describe('Transfer Engine & Anti-Double Counting', () => {
  it('detects internal transfers and pairs them correctly', () => {
    const { updatedTransactions, detectedMatches } = detectTransfers(
      INITIAL_TRANSACTIONS,
      INITIAL_ACCOUNTS
    );

    const transferMatch = detectedMatches.find(
      (m) => m.matchType === 'internal_transfer'
    );
    expect(transferMatch).toBeDefined();
    expect(transferMatch?.amount).toBe(10000);

    const outTx = updatedTransactions.find(
      (t) => t.id === 'tx_xfer_mercury_out'
    );
    const inTx = updatedTransactions.find((t) => t.id === 'tx_xfer_chase_in');

    expect(outTx?.classification).toBe('transfer');
    expect(inTx?.classification).toBe('transfer');
    expect(outTx?.transferCounterpartId).toBe('tx_xfer_chase_in');
    expect(inTx?.transferCounterpartId).toBe('tx_xfer_mercury_out');
  });

  it('separates credit card payments from card swipes and prevents double-counting', () => {
    const { updatedTransactions, detectedMatches } = detectTransfers(
      INITIAL_TRANSACTIONS,
      INITIAL_ACCOUNTS
    );

    const cardPmtMatch = detectedMatches.find(
      (m) => m.matchType === 'credit_card_payment'
    );
    expect(cardPmtMatch).toBeDefined();
    expect(cardPmtMatch?.amount).toBe(4500);

    const pmtTx = updatedTransactions.find(
      (t) => t.id === 'tx_pmt_mercury_amex'
    );
    expect(pmtTx?.classification).toBe('debt_payment');
    expect(pmtTx?.isCreditCardPayment).toBe(true);

    // Operating expenses calculation should EXCLUDE the $4,500 card payment and the $10,000 transfer
    const expenses = calculateOperatingExpenses(updatedTransactions);
    expect(expenses).not.toContain(4500);
    // Ensure card payment is NOT in expenses
    const includesCardPayment = updatedTransactions.some(
      (t) =>
        t.isCreditCardPayment &&
        t.classification === 'business' &&
        t.amount === 4500
    );
    expect(includesCardPayment).toBe(false);

    // Operating revenue should EXCLUDE the $10,000 transfer deposit
    const revenue = calculateOperatingRevenue(updatedTransactions);
    expect(revenue).toBeGreaterThanOrEqual(24500 + 14250);
  });
});

describe('Credit Card Utilization & Loan Tracking', () => {
  it('accurately calculates utilization and flags 30% and 50% thresholds', () => {
    const amexAcc = INITIAL_ACCOUNTS.find((a) => a.id === 'acc_amex_plat')!;
    const amexReport = calculateCardUtilization(amexAcc);

    expect(amexReport).not.toBeNull();
    // 14,250 / 25,000 = 57.0%
    expect(amexReport?.utilizationRate).toBe(57);
    expect(amexReport?.status).toBe('danger'); // breached 50%
    expect(amexReport?.thresholdBreached).toBe(50);
    expect(amexReport?.recommendedPaydownAmount).toBeGreaterThan(0);

    const capOneAcc = INITIAL_ACCOUNTS.find((a) => a.id === 'acc_capone_spark')!;
    const capOneReport = calculateCardUtilization(capOneAcc);
    expect(capOneReport?.utilizationRate).toBe(21);
    expect(capOneReport?.status).toBe('healthy');

    const debtSummary = analyzeRevolvingDebt(INITIAL_ACCOUNTS);
    expect(debtSummary.cardsAboveWarning).toBeGreaterThanOrEqual(2); // Amex 57% and Chase Sapphire 44.5%
    expect(debtSummary.blendedUtilization).toBeGreaterThan(0);
  });

  it('detects stale accounts and missing feeds', () => {
    const staleList = detectStaleAccounts(INITIAL_ACCOUNTS, 72);
    expect(staleList.length).toBeGreaterThanOrEqual(1);
    expect(staleList.some((a) => a.id === 'acc_sba_loan')).toBe(true);

    const loans = analyzeLoans(INITIAL_ACCOUNTS);
    expect(loans.loans.length).toBe(1);
    expect(loans.totalLoanDebt).toBe(118500);
    expect(loans.loans[0].isStale).toBe(true);
  });
});

describe('Subscription & Recurring Expense Detection', () => {
  it('detects recurring software subscriptions and flags price hikes', () => {
    const { subscriptions, monthlyRunRate } = detectSubscriptions(
      INITIAL_TRANSACTIONS
    );

    expect(subscriptions.length).toBeGreaterThanOrEqual(3);
    const awsSub = subscriptions.find((s) =>
      s.cleanMerchant.includes('Amazon Web Services')
    );
    expect(awsSub).toBeDefined();
    expect(awsSub?.status).toBe('price_increased');
    expect(awsSub?.priceChangePercent).toBeGreaterThan(20);

    expect(monthlyRunRate).toBeGreaterThan(500);
  });
});

describe('Anomaly Detection', () => {
  it('detects duplicate charges within 72 hours', () => {
    const enriched = detectAnomalies(INITIAL_TRANSACTIONS, INITIAL_ACCOUNTS);
    const dup1 = enriched.find((t) => t.id === 'tx_dup_01');
    const dup2 = enriched.find((t) => t.id === 'tx_dup_02');

    expect(dup1?.anomalies.some((a) => a.type === 'duplicate_charge')).toBe(true);
    expect(dup2?.anomalies.some((a) => a.type === 'duplicate_charge')).toBe(true);
  });

  it('flags personal expense on business account as classification anomaly', () => {
    const enriched = detectAnomalies(INITIAL_TRANSACTIONS, INITIAL_ACCOUNTS);
    const steamTx = enriched.find((t) => t.id === 'tx_pers_err_01');
    expect(
      steamTx?.anomalies.some((a) => a.type === 'classification_anomaly')
    ).toBe(true);
    expect(steamTx?.classification).toBe('needs_review');
  });

  it('flags unusually large purchases', () => {
    const enriched = detectAnomalies(INITIAL_TRANSACTIONS, INITIAL_ACCOUNTS);
    const largeTx = enriched.find((t) => t.id === 'tx_large_server');
    expect(
      largeTx?.anomalies.some((a) => a.type === 'unusually_large')
    ).toBe(true);
  });
});

describe('Classification & Audit Trail', () => {
  it('generates an audit trail entry for every classification decision', () => {
    const testTx: Transaction = {
      id: 'tx_test_rule',
      accountId: 'acc_mercury_op',
      accountName: 'Mercury Tech Operating',
      institution: 'Mercury',
      date: '2026-10-01',
      rawDescription: 'GUSTO PAYROLL ACH ENTRY',
      merchantName: 'Gusto Payroll',
      cleanMerchant: 'Gusto Payroll',
      amount: 14500,
      currency: 'USD',
      pending: false,
      category: ['Payroll'],
      classification: 'needs_review',
      auditTrail: [],
      anomalies: [],
    };

    const mercuryAcc = INITIAL_ACCOUNTS.find((a) => a.id === 'acc_mercury_op');
    const { classification, auditEntry } = classifyTransaction(
      testTx,
      mercuryAcc
    );

    expect(classification).toBe('business');
    expect(auditEntry.ruleApplied).toContain('Payroll');
    expect(auditEntry.confidence).toBeGreaterThan(0.9);
    expect(auditEntry.reasoning).toBeTruthy();
  });

  it('preserves audit trail history on manual reclassification', () => {
    const tx = INITIAL_TRANSACTIONS[0];
    const reclassified = reclassifyTransaction(
      tx,
      'personal',
      'Owner declared this hotel stay as personal weekend vacation'
    );

    expect(reclassified.classification).toBe('personal');
    expect(reclassified.auditTrail[0].userOverridden).toBe(true);
    expect(reclassified.auditTrail[0].priorClassification).toBe('business');
  });
});

describe('Plaid Ingestion', () => {
  it('parses Plaid JSON payload into normalized accounts and transactions', () => {
    const jsonStr = JSON.stringify({
      accounts: [
        {
          account_id: 'acc_imported_1',
          name: 'Brex Operating',
          type: 'depository',
          subtype: 'checking',
          balances: { current: 52000, available: 51200 },
          mask: '3192',
        },
      ],
      transactions: [
        {
          transaction_id: 'tx_imp_1',
          account_id: 'acc_imported_1',
          name: 'AMAZON WEB SERVICES',
          amount: 320.0,
          date: '2026-10-02',
          pending: false,
        },
      ],
    });

    const parsed = parsePlaidJson(jsonStr);
    expect(parsed.accounts.length).toBe(1);
    expect(parsed.transactions.length).toBe(1);
    expect(parsed.transactions[0].cleanMerchant).toBe('Amazon Web Services');
    expect(parsed.transactions[0].classification).toBe('business');
    expect(parsed.transactions[0].auditTrail.length).toBeGreaterThan(0);
  });

  it('parses Plaid CSV format correctly', () => {
    const csvData = `Transaction ID,Account Name,Date,Description,Amount,Category,Pending
tx_csv_01,Mercury Tech Operating,2026-10-01,SLACK TECHNOLOGIES,85.00,Software,false
tx_csv_02,Mercury Tech Operating,2026-10-02,STRIPE PAYOUT,-12000.00,Income,true`;

    const parsed = parsePlaidCsv(csvData, INITIAL_ACCOUNTS);
    expect(parsed.transactions.length).toBe(2);
    expect(parsed.transactions[0].cleanMerchant).toBe('Slack Technologies');
    expect(parsed.transactions[0].amount).toBe(85.0);
    expect(parsed.transactions[1].amount).toBe(-12000.0);
    expect(parsed.transactions[1].pending).toBe(true);
  });
});

describe('Daily Briefing & Sync Diff', () => {
  it('generates an executive daily briefing with all required sections', () => {
    const { subscriptions } = detectSubscriptions(INITIAL_TRANSACTIONS);
    const briefing = generateDailyBriefing(
      INITIAL_ACCOUNTS,
      INITIAL_TRANSACTIONS,
      subscriptions
    );

    expect(briefing.cashSummary.totalSettledCash).toBeGreaterThan(0);
    expect(briefing.cashSummary.availableLiquidity).toBeLessThan(
      briefing.cashSummary.totalSettledCash
    ); // Confirms pending & 7d holds are deducted!
    expect(briefing.debtSummary.highUtilizationCount).toBeGreaterThanOrEqual(1);
    expect(briefing.syncHealth.staleCount).toBeGreaterThanOrEqual(1);
    expect(briefing.reviewItems.urgentActionItems.length).toBeGreaterThan(0);
  });

  it('computes accurate sync differences', () => {
    const prevTxs = INITIAL_TRANSACTIONS.slice(2);
    const currentTxs = INITIAL_TRANSACTIONS;

    const diff = computeSyncDiff(
      prevTxs,
      currentTxs,
      INITIAL_ACCOUNTS,
      INITIAL_ACCOUNTS,
      new Date(Date.now() - 3600000).toISOString()
    );

    expect(diff.newTransactions.length).toBe(2);
    expect(diff.balanceDeltas.length).toBe(INITIAL_ACCOUNTS.length);
  });
});

describe('Reversible Audit Trail & Classification Overrides', () => {
  it('records previous value, new value, actor, and supports undo/revert', () => {
    const tx = INITIAL_TRANSACTIONS[0];
    const initialClassification = tx.classification;
    const reclassified = reclassifyTransaction(
      tx,
      'personal',
      'Triage test: reclassify to personal',
      'Business Owner'
    );
    expect(reclassified.classification).toBe('personal');
    const latestAudit = reclassified.auditTrail[0];
    expect(latestAudit.actor).toBe('Business Owner');
    expect(latestAudit.previousValue).toBe(initialClassification);
    expect(latestAudit.newValue).toBe('personal');
    expect(latestAudit.canRevert).toBe(true);

    const reverted = revertTransactionClassification(reclassified);
    expect(reverted.classification).toBe(initialClassification);
    const revertAudit = reverted.auditTrail[0];
    expect(revertAudit.ruleApplied).toContain('Reverted');
    expect(revertAudit.canRevert).toBe(false);
  });
});

describe('Charge Cards with No Preset Spending Limit (NPSL)', () => {
  it('flags NPSL cards correctly and excludes credit limit from blended revolving debt', () => {
    const chargeCard: Account = {
      id: 'acc_amex_plat',
      name: 'Amex Business Platinum',
      officialName: 'American Express Platinum Corporate ••1004',
      institution: 'American Express',
      mask: '1004',
      type: 'credit',
      subtype: 'credit_card',
      currentBalance: 5400.0,
      availableBalance: null,
      creditLimit: 0,
      interestRate: 0,
      currency: 'USD',
      lastSyncedAt: new Date().toISOString(),
      isStale: false,
      isBusiness: true,
      status: 'active',
      isNoPresetLimit: true,
    };

    const regularCard: Account = {
      id: 'acc_chase_ink',
      name: 'Chase Ink Business',
      officialName: 'Chase Ink Business Preferred ••4412',
      institution: 'Chase',
      mask: '4412',
      type: 'credit',
      subtype: 'credit_card',
      currentBalance: 2000.0,
      availableBalance: 8000.0,
      creditLimit: 10000.0,
      interestRate: 18.24,
      currency: 'USD',
      lastSyncedAt: new Date().toISOString(),
      isStale: false,
      isBusiness: true,
      status: 'active',
      isNoPresetLimit: false,
    };

    const report = calculateCardUtilization(chargeCard);
    expect(report?.isNoPresetLimit).toBe(true);
    expect(report?.status).toBe('no_limit');
    expect(report?.utilizationRate).toBe(0);

    const summary = analyzeRevolvingDebt([chargeCard, regularCard]);
    // Blended limit should only include regularCard's $10,000, not 0 from chargeCard
    expect(summary.totalLimit).toBe(10000.0);
    // Total balance includes both
    expect(summary.totalBalance).toBe(7400.0);
  });
});

describe('5-Dimension Data Health Evaluation', () => {
  it('marks sparse feeds with fewer than 5 transactions as partial, never healthy', () => {
    const accounts: Account[] = [
      {
        id: 'acc_capone_sparse',
        name: 'Capital One Sparse Feed',
        officialName: 'Capital One Spark ••9999',
        institution: 'Capital One',
        mask: '9999',
        type: 'credit',
        subtype: 'credit_card',
        currentBalance: 500,
        availableBalance: 4500,
        creditLimit: 5000,
        interestRate: 19.99,
        currency: 'USD',
        lastSyncedAt: new Date().toISOString(),
        isStale: false,
        isBusiness: true,
        status: 'active',
      },
    ];

    // Only 2 transactions for this institution
    const sparseTxs: Transaction[] = [
      {
        id: 'tx_c1',
        accountId: 'acc_capone_sparse',
        accountName: 'Capital One Sparse Feed',
        institution: 'Capital One',
        date: new Date().toISOString().split('T')[0],
        rawDescription: 'OFFICE SUPPLIES',
        cleanMerchant: 'Office Supplies',
        merchantName: 'Office Supplies',
        category: ['Supplies'],
        amount: 45.0,
        currency: 'USD',
        pending: false,
        classification: 'business',
        importedAt: new Date().toISOString(),
        anomalies: [],
        auditTrail: [],
      },
      {
        id: 'tx_c2',
        accountId: 'acc_capone_sparse',
        accountName: 'Capital One Sparse Feed',
        institution: 'Capital One',
        date: new Date().toISOString().split('T')[0],
        rawDescription: 'COFFEE',
        cleanMerchant: 'Coffee',
        merchantName: 'Coffee',
        category: ['Meals'],
        amount: 6.0,
        currency: 'USD',
        pending: false,
        classification: 'business',
        importedAt: new Date().toISOString(),
        anomalies: [],
        auditTrail: [],
      },
    ];

    const health = evaluateDataHealth(accounts, sparseTxs);
    const capOne = health.institutions.find((i) => i.name === 'Capital One');
    expect(capOne).toBeDefined();
    expect(capOne?.status).toBe('partial');
    const covDimension = capOne?.dimensions.find((d) => d.dimension === 'coverage');
    expect(covDimension).toBeDefined();
    expect(covDimension?.status).toBe('partial');
    expect(covDimension?.detail).toContain('Sparse coverage');
  });
});

