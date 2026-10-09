import { describe, it, expect } from 'vitest';
import {
  generateCompleteUploadSummary,
  generateAttentionItems,
  answerFinancialQuery,
  FinancialContextSnapshot,
} from '../services/aiAgentEngine';
import { Account, Transaction, Subscription, DailyBriefing, FinancialDataHealth } from '../types';

describe('aiAgentEngine Financial AI Assistant', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc_chk_01',
      name: 'Chase Operating Checking',
      officialName: 'Chase Business Operating',
      institution: 'Chase',
      mask: '4488',
      type: 'depository',
      subtype: 'checking',
      currentBalance: 35000,
      availableBalance: 32000,
      currency: 'USD',
      lastSyncedAt: '2026-10-04T10:00:00Z',
      isStale: false,
      isBusiness: true,
      status: 'active',
    },
    {
      id: 'acc_cc_01',
      name: 'Amex Business Gold',
      officialName: 'American Express Business Gold',
      institution: 'American Express',
      mask: '1002',
      type: 'credit',
      subtype: 'credit_card',
      currentBalance: 12000,
      creditLimit: 20000, // 60% utilization -> above warning threshold (30%)
      availableBalance: 8000,
      currency: 'USD',
      lastSyncedAt: '2026-10-04T10:00:00Z',
      isStale: false,
      isBusiness: true,
      status: 'active',
    },
    {
      id: 'acc_loan_01',
      name: 'SBA 7(a) Term Loan',
      officialName: 'U.S. SBA Commercial Term Loan',
      institution: 'Live Oak Bank',
      mask: '9921',
      type: 'loan',
      subtype: 'term_loan',
      currentBalance: 75000,
      availableBalance: 0,
      interestRate: 6.5,
      monthlyPayment: 1100,
      currency: 'USD',
      lastSyncedAt: '2026-10-04T10:00:00Z',
      isStale: false,
      isBusiness: true,
      status: 'active',
    },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx_01',
      accountId: 'acc_chk_01',
      accountName: 'Chase Operating Checking',
      institution: 'Chase',
      date: '2026-10-03',
      amount: 450,
      currency: 'USD',
      merchantName: 'Office Supplies Inc',
      cleanMerchant: 'Office Supplies Inc',
      rawDescription: 'OFFICE DEPOT 4488',
      classification: 'business',
      category: ['Supplies'],
      pending: false,
      status: 'posted',
      entity: 'business',
      auditTrail: [],
      anomalies: [],
    },
    {
      id: 'tx_02',
      accountId: 'acc_cc_01',
      accountName: 'Amex Business Gold',
      institution: 'American Express',
      date: '2026-10-04',
      amount: 125,
      currency: 'USD',
      merchantName: 'Gas Station',
      cleanMerchant: 'Gas Station',
      rawDescription: 'CHEVRON SWIPE',
      classification: 'needs_review',
      category: ['Fuel'],
      pending: true,
      status: 'pending',
      entity: 'business',
      auditTrail: [],
      anomalies: [
        {
          id: 'anom_01',
          type: 'duplicate_charge',
          severity: 'medium',
          message: 'Potential duplicate charge observed within 24 hours',
        },
      ],
    },
  ];

  const mockSubscriptions: Subscription[] = [
    {
      id: 'sub_01',
      cleanMerchant: 'Slack Technologies',
      frequency: 'monthly',
      averageAmount: 180,
      lastAmount: 180,
      lastBilledDate: '2026-09-15',
      nextEstimatedDate: '2026-10-15',
      category: 'Software',
      accountName: 'Chase Operating Checking',
      accountId: 'acc_chk_01',
      status: 'active',
      transactionCount: 4,
      confidence: 'owner_confirmed',
      isEstimatedDate: false,
    },
  ];

  const mockBriefing: DailyBriefing = {
    generatedAt: '2026-10-04T10:00:00Z',
    cashSummary: {
      totalSettledCash: 35000,
      availableLiquidity: 30000,
      businessSettledCash: 35000,
      personalSettledCash: 0,
      businessAvailableLiquidity: 30000,
      personalAvailableLiquidity: 0,
      committedHold: 5000,
      netCashChange24h: -575,
      burnRate7d: 2100,
      hasStaleFeedsWarning: false,
      staleFeedsCount: 0,
      dataTimestamp: '2026-10-04T10:00:00Z',
    },
    debtSummary: {
      totalCreditDebt: 12000,
      totalCreditLimit: 20000,
      blendedUtilization: 60,
      highUtilizationCount: 1,
      totalLoanBalance: 75000,
      debtChange24h: 125,
    },
    spendSummary: {
      totalSpend24h: 575,
      businessSpend24h: 575,
      personalSpend24h: 0,
      largestTransaction: mockTransactions[0],
    },
    pendingSummary: {
      pendingCount: 1,
      pendingOutflows: 125,
      pendingInflows: 0,
    },
    upcomingObligations: [
      {
        id: 'ob_01',
        name: 'Slack Technologies',
        dueDate: '2026-10-15',
        amount: 180,
        type: 'subscription',
        accountName: 'Chase Operating Checking',
      },
    ],
    syncHealth: {
      totalAccounts: 3,
      activeCount: 3,
      staleCount: 0,
      staleAccounts: [],
    },
    reviewItems: {
      needsReviewCount: 1,
      anomaliesCount: 1,
      urgentActionItems: ['1 transaction in Needs Review', 'Amex Business Gold utilization at 60%'],
    },
  };

  const mockDataHealth: FinancialDataHealth = {
    overallConfidenceScore: 92,
    status: 'healthy',
    confidenceFactors: [],
    institutions: [
      {
        name: 'Chase',
        accountCount: 1,
        lastSyncTimestamp: '2026-10-04T10:00:00Z',
        sourceBalanceTimestamp: '2026-10-04T10:00:00Z',
        status: 'active',
        dimensions: [],
        transactionCoverage: { earliestDate: '2026-09-01', latestDate: '2026-10-04', count: 10 },
      },
    ],
    unresolvedIssues: [],
    totalActiveAccounts: 3,
    totalTransactionsRecorded: 2,
    unreviewedTransactionsCount: 1,
  };

  const snapshot: FinancialContextSnapshot = {
    businessName: 'Apex Innovations LLC',
    dataMode: 'imported_csv',
    accounts: mockAccounts,
    transactions: mockTransactions,
    subscriptions: mockSubscriptions,
    notes: [],
    briefing: mockBriefing,
    dataHealth: mockDataHealth,
    latestReconciliationReport: null,
    thresholds: { warningThreshold: 30, dangerThreshold: 50, criticalThreshold: 80 },
  };

  it('generateCompleteUploadSummary produces a comprehensive breakdown with action shortcuts', () => {
    const summary = generateCompleteUploadSummary(snapshot);

    expect(summary.content).toContain('Complete Upload & Ledger Executive Summary');
    expect(summary.content).toContain('Apex Innovations LLC');
    expect(summary.content).toContain('35,000'); // Depository cash
    expect(summary.content).toContain('12,000'); // Credit card debt
    expect(summary.content).toContain('75,000'); // Loan debt
    expect(summary.content).toContain('Amex Business Gold'); // High util alert

    // Summary cards
    expect(summary.summaryCards).toBeDefined();
    expect(summary.summaryCards!.length).toBeGreaterThanOrEqual(4);
    expect(summary.summaryCards![0].title).toBe('True Available Cash');

    // Deep-linking shortcuts
    expect(summary.shortcuts).toBeDefined();
    const shortcutTabs = summary.shortcuts!.map((s) => s.targetTab);
    expect(shortcutTabs).toContain('cards-loans');
    expect(shortcutTabs).toContain('transactions');
    expect(shortcutTabs).toContain('anomalies');
  });

  it('generateAttentionItems surfaces urgent action items and high utilization warnings', () => {
    const attention = generateAttentionItems(snapshot);

    expect(attention.content).toContain('Immediate Action Items Requiring Attention');
    expect(attention.content).toContain('High Credit Card Utilization');
    expect(attention.content).toContain('Amex Business Gold');
    expect(attention.content).toContain('Quarantined Transactions');

    // Action shortcuts generated
    expect(attention.shortcuts).toBeDefined();
    expect(attention.shortcuts!.some((s) => s.targetTab === 'cards-loans')).toBe(true);
    expect(attention.shortcuts!.some((s) => s.targetTab === 'transactions')).toBe(true);
    expect(attention.shortcuts!.some((s) => s.targetTab === 'anomalies')).toBe(true);
  });

  it('answerFinancialQuery routes upload summary queries accurately', () => {
    const answer = answerFinancialQuery('Can you do a summary of everything that is uploaded?', snapshot);
    expect(answer.content).toContain('Complete Upload & Ledger Executive Summary');
    expect(answer.shortcuts?.length).toBeGreaterThan(0);
  });

  it('answerFinancialQuery answers credit card & utilization questions with direct shortcuts', () => {
    const answer = answerFinancialQuery('What is my credit card utilization and limits?', snapshot);
    expect(answer.content).toContain('Credit Cards & Utilization Breakdown');
    expect(answer.content).toContain('Amex Business Gold');
    expect(answer.content).toContain('60.0%');
    expect(answer.shortcuts?.some((s) => s.targetTab === 'cards-loans')).toBe(true);
  });

  it('answerFinancialQuery answers cash and liquidity questions with waterfall details', () => {
    const answer = answerFinancialQuery('How is my cash and checking balance looking?', snapshot);
    expect(answer.content).toContain('Cash & Liquidity Breakdown');
    expect(answer.content).toContain('True Available Cash');
    expect(answer.content).toContain('Chase Operating Checking');
    expect(answer.shortcuts?.some((s) => s.targetTab === 'overview')).toBe(true);
  });

  it('answerFinancialQuery answers anomaly questions and links to Anomalies Hub', () => {
    const answer = answerFinancialQuery('Are there any unusual charges or duplicate swipes?', snapshot);
    expect(answer.content).toContain('Anomalies & Duplicate Detection');
    expect(answer.content).toContain('Potential duplicate charge observed');
    expect(answer.shortcuts?.some((s) => s.targetTab === 'anomalies')).toBe(true);
  });

  it('answerFinancialQuery answers specific institution queries (Chase)', () => {
    const answer = answerFinancialQuery('How is Chase looking?', snapshot);
    expect(answer.content).toContain('Chase Operating Checking');
    expect(answer.shortcuts?.some((s) => s.targetTab === 'cards-loans' || s.targetTab === 'transactions')).toBe(true);
  });

  it('answerFinancialQuery handles batch mark rest as personal directive with action shortcut', () => {
    const answer = answerFinancialQuery('in a batch can you mark the rest as personal', snapshot);
    expect(answer.content).toContain('Batch Reclassification: Mark Remaining as Personal');
    expect(answer.shortcuts?.some((s) => s.type === 'batch_classify_personal')).toBe(true);
  });
});
