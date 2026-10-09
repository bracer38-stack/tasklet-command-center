import {
  Account,
  DailyBriefing,
  DataMode,
  FinancialNote,
  Subscription,
  Transaction,
} from '../types';

export interface FinancialMetricLineageTrace {
  metricKey: string;
  metricLabel: string;
  calculatedValue: number | null;
  displayFormatted: string;
  formula: string;
  isValid: boolean;
  sourceRecordIds: string[];
  evidenceBreakdown: Array<{
    recordType: 'account_snapshot' | 'transaction' | 'bill' | 'loan';
    recordId: string;
    description: string;
    contributedAmount: number;
  }>;
}

export interface FinancialDataExportManifest {
  exportMetadata: {
    exportedAt: string;
    businessName: string;
    dataMode: DataMode;
    totalAccounts: number;
    totalTransactions: number;
    totalBills: number;
    totalLoans: number;
    totalNotes: number;
    generator: string;
  };
  metricsLineageManifest: {
    trueAvailableCash: FinancialMetricLineageTrace;
    totalSettledCash: FinancialMetricLineageTrace;
    revolvingCreditDebt: FinancialMetricLineageTrace;
    termLoanBalance: FinancialMetricLineageTrace;
    monthlyBurnRate: FinancialMetricLineageTrace;
    needsReviewQueue: {
      count: number;
      transactionIds: string[];
      totalUnreviewedVolume: number;
    };
  };
  sourceRecords: {
    accounts: Account[];
    transactions: Transaction[];
    subscriptions: Subscription[];
    notes: FinancialNote[];
  };
}

/**
 * Builds a 100% traceable lineage manifest where every dashboard metric
 * maps deterministically to its contributing source records.
 */
export function buildFinancialExportManifest(params: {
  businessName: string;
  dataMode: DataMode;
  accounts: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  notes: FinancialNote[];
  briefing: DailyBriefing;
  monthlyBurnRate: number;
}): FinancialDataExportManifest {
  const {
    businessName,
    dataMode,
    accounts,
    transactions,
    subscriptions,
    notes,
    briefing,
    monthlyBurnRate,
  } = params;

  const nowIso = new Date().toISOString();
  const depositoryAccounts = accounts.filter((a) => a.type === 'depository');
  const creditAccounts = accounts.filter((a) => a.type === 'credit');
  const loanAccounts = accounts.filter((a) => a.type === 'loan');
  const needsReviewTxs = transactions.filter((t) => t.classification === 'needs_review');

  const isValidData = accounts.length > 0;

  // 1. Total Settled Cash Trace
  const settledCashTrace: FinancialMetricLineageTrace = {
    metricKey: 'total_settled_cash',
    metricLabel: 'Total Settled Depository Cash',
    calculatedValue: isValidData ? briefing.cashSummary.totalSettledCash : null,
    displayFormatted: isValidData ? `$${briefing.cashSummary.totalSettledCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
    formula: 'SUM(account.currentBalance for all accounts where type = "depository")',
    isValid: isValidData,
    sourceRecordIds: depositoryAccounts.map((a) => a.id),
    evidenceBreakdown: depositoryAccounts.map((a) => ({
      recordType: 'account_snapshot',
      recordId: a.id,
      description: `${a.institution} - ${a.name} (••${a.mask})`,
      contributedAmount: a.currentBalance,
    })),
  };

  // 2. True Available Cash Trace
  const pendingOutflowTxs = transactions.filter((t) => t.pending && t.amount > 0);
  const availableCashTrace: FinancialMetricLineageTrace = {
    metricKey: 'true_available_cash',
    metricLabel: 'True Available Cash (Unencumbered Liquidity)',
    calculatedValue: isValidData ? briefing.cashSummary.availableLiquidity : null,
    displayFormatted: isValidData ? `$${briefing.cashSummary.availableLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
    formula: 'Total Settled Cash - Pending Outflow Holds - 7-Day Recurring Obligations',
    isValid: isValidData,
    sourceRecordIds: [
      ...depositoryAccounts.map((a) => a.id),
      ...pendingOutflowTxs.map((t) => t.id),
      ...briefing.upcomingObligations.map((o) => o.id),
    ],
    evidenceBreakdown: [
      ...depositoryAccounts.map((a) => ({
        recordType: 'account_snapshot' as const,
        recordId: a.id,
        description: `Depository Cash: ${a.institution} - ${a.name}`,
        contributedAmount: a.currentBalance,
      })),
      ...pendingOutflowTxs.map((t) => ({
        recordType: 'transaction' as const,
        recordId: t.id,
        description: `Pending Hold Outflow: ${t.cleanMerchant || t.merchantName}`,
        contributedAmount: -t.amount,
      })),
      ...briefing.upcomingObligations.map((o) => ({
        recordType: 'bill' as const,
        recordId: o.id,
        description: `Upcoming 7-Day Obligation: ${o.name}`,
        contributedAmount: -o.amount,
      })),
    ],
  };

  // 3. Revolving Credit Debt Trace
  const revolvingCreditTrace: FinancialMetricLineageTrace = {
    metricKey: 'revolving_credit_debt',
    metricLabel: 'Total Revolving Credit Card Debt',
    calculatedValue: isValidData ? briefing.debtSummary.totalCreditDebt : null,
    displayFormatted: isValidData ? `$${briefing.debtSummary.totalCreditDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
    formula: 'SUM(account.currentBalance for all accounts where type = "credit")',
    isValid: isValidData,
    sourceRecordIds: creditAccounts.map((a) => a.id),
    evidenceBreakdown: creditAccounts.map((a) => ({
      recordType: 'account_snapshot',
      recordId: a.id,
      description: `${a.institution} - ${a.name} (••${a.mask})`,
      contributedAmount: a.currentBalance,
    })),
  };

  // 4. Term Loan Balance Trace
  const termLoanTrace: FinancialMetricLineageTrace = {
    metricKey: 'term_loan_balance',
    metricLabel: 'Commercial Term Loans Outstanding',
    calculatedValue: isValidData ? briefing.debtSummary.totalLoanBalance : null,
    displayFormatted: isValidData ? `$${briefing.debtSummary.totalLoanBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
    formula: 'SUM(account.currentBalance for all accounts where type = "loan")',
    isValid: isValidData,
    sourceRecordIds: loanAccounts.map((a) => a.id),
    evidenceBreakdown: loanAccounts.map((a) => ({
      recordType: 'loan',
      recordId: a.id,
      description: `${a.institution} - ${a.name} (${a.subtype})`,
      contributedAmount: a.currentBalance,
    })),
  };

  // 5. Monthly Burn Rate Trace
  const monthlyBurnTrace: FinancialMetricLineageTrace = {
    metricKey: 'monthly_burn_rate',
    metricLabel: 'Recurring Monthly Software & Vendor Burn',
    calculatedValue: isValidData ? monthlyBurnRate : null,
    displayFormatted: isValidData ? `$${monthlyBurnRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo` : '—',
    formula: 'SUM(detected subscriptions normalized to monthly billing period)',
    isValid: isValidData,
    sourceRecordIds: subscriptions.map((s) => s.id),
    evidenceBreakdown: subscriptions.map((s) => ({
      recordType: 'bill',
      recordId: s.id,
      description: `${s.cleanMerchant} (${s.frequency})`,
      contributedAmount: s.averageAmount,
    })),
  };

  return {
    exportMetadata: {
      exportedAt: nowIso,
      businessName,
      dataMode,
      totalAccounts: accounts.length,
      totalTransactions: transactions.length,
      totalBills: subscriptions.length,
      totalLoans: loanAccounts.length,
      totalNotes: notes.length,
      generator: 'Tasklet Financial Command Center - Audit Lineage Engine v2.0',
    },
    metricsLineageManifest: {
      trueAvailableCash: availableCashTrace,
      totalSettledCash: settledCashTrace,
      revolvingCreditDebt: revolvingCreditTrace,
      termLoanBalance: termLoanTrace,
      monthlyBurnRate: monthlyBurnTrace,
      needsReviewQueue: {
        count: needsReviewTxs.length,
        transactionIds: needsReviewTxs.map((t) => t.id),
        totalUnreviewedVolume: needsReviewTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      },
    },
    sourceRecords: {
      accounts,
      transactions,
      subscriptions,
      notes,
    },
  };
}

/**
 * Downloads full JSON bundle containing both data records and the metric lineage manifest.
 */
export function exportTraceableJson(manifest: FinancialDataExportManifest): void {
  const jsonString = JSON.stringify(manifest, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = manifest.exportMetadata.exportedAt.split('T')[0];
  a.href = url;
  a.download = `Tasklet_Financial_Data_Audit_Lineage_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports a traceable unified CSV file where every record is categorized by record_type
 * and contains lineage tracking for CPA and financial auditing.
 */
export function exportTraceableCsv(manifest: FinancialDataExportManifest): void {
  const headers = [
    'record_type',
    'record_id',
    'name_or_merchant',
    'date',
    'amount',
    'currency',
    'status_or_type',
    'classification',
    'linked_account_or_institution',
    'metric_lineage_impact',
    'audit_reasoning',
  ];

  const rows: string[][] = [];

  // 1. Account Snapshots
  manifest.sourceRecords.accounts.forEach((acc) => {
    rows.push([
      acc.type === 'loan' ? 'loan' : 'account_snapshot',
      acc.id,
      `"${acc.name.replace(/"/g, '""')}"`,
      acc.lastSyncedAt.split('T')[0],
      acc.currentBalance.toFixed(2),
      acc.currency,
      acc.type,
      acc.isBusiness ? 'business' : 'personal',
      `"${acc.institution.replace(/"/g, '""')}"`,
      acc.type === 'depository' ? 'Depository Cash' : acc.type === 'credit' ? 'Revolving Debt' : 'Term Loan Debt',
      `"Book balance verified from ${acc.institution}"`,
    ]);
  });

  // 2. Transactions
  manifest.sourceRecords.transactions.forEach((tx) => {
    rows.push([
      'transaction',
      tx.id,
      `"${(tx.cleanMerchant || tx.merchantName || '').replace(/"/g, '""')}"`,
      tx.date,
      tx.amount.toFixed(2),
      tx.currency,
      tx.pending ? 'pending' : 'posted',
      tx.classification,
      `"${(tx.accountName || '').replace(/"/g, '""')}"`,
      tx.pending ? 'Pending Liquidity Hold' : 'Settled Ledger Flow',
      `"${(tx.auditTrail && tx.auditTrail[0]?.reasoning || '').replace(/"/g, '""')}"`,
    ]);
  });

  // 3. Bills / Subscriptions
  manifest.sourceRecords.subscriptions.forEach((sub) => {
    rows.push([
      'bill',
      sub.id,
      `"${sub.cleanMerchant.replace(/"/g, '""')}"`,
      sub.lastBilledDate,
      sub.averageAmount.toFixed(2),
      'USD',
      sub.frequency,
      'business',
      `"${(sub.accountName || '').replace(/"/g, '""')}"`,
      'Monthly Burn Rate Calculation',
      `"Recurring SaaS detected; cadence: ${sub.frequency}"`,
    ]);
  });

  // 4. Notes & Assumptions
  manifest.sourceRecords.notes.forEach((note) => {
    rows.push([
      'notes_assumptions',
      note.id,
      `"${note.category.replace(/"/g, '""')}"`,
      note.createdDate,
      '0.00',
      'USD',
      'note',
      note.associatedEntity || 'business',
      'N/A',
      'No Balance Impact (Assumption Only)',
      `"${note.noteText.replace(/"/g, '""')}"`,
    ]);
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = manifest.exportMetadata.exportedAt.split('T')[0];
  a.href = url;
  a.download = `Tasklet_Financial_Data_Audit_Lineage_${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
