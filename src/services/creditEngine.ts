import { Account, UtilizationThresholds } from '../types';

export interface CardUtilizationReport {
  accountId: string;
  accountName: string;
  institution: string;
  currentBalance: number;
  creditLimit: number;
  availableCredit: number;
  utilizationRate: number; // 0 - 100
  status: 'healthy' | 'warning' | 'danger' | 'critical' | 'no_limit';
  thresholdBreached: number | null;
  recommendedPaydownAmount: number; // Paydown needed to get back below 30%
  isNoPresetLimit?: boolean;
  paydownWording?: string;
}

export interface RevolvingDebtSummary {
  totalBalance: number;
  totalLimit: number;
  blendedUtilization: number;
  cardsCount: number;
  cardsAboveWarning: number;
  cardsAboveDanger: number;
  cardsAboveCritical: number;
  reports: CardUtilizationReport[];
}

export interface LoanReport {
  accountId: string;
  accountName: string;
  institution: string;
  subtype: string;
  remainingBalance: number;
  interestRate?: number;
  monthlyPayment?: number;
  maturityDate?: string;
  isStale: boolean;
  staleReason?: string;
  lastSyncedAt: string;
}

export const DEFAULT_THRESHOLDS: UtilizationThresholds = {
  warningThreshold: 30,
  dangerThreshold: 50,
  criticalThreshold: 80,
};

export function calculateCardUtilization(
  account: Account,
  thresholds: UtilizationThresholds = DEFAULT_THRESHOLDS
): CardUtilizationReport | null {
  if (account.type !== 'credit') return null;

  const isNoPreset =
    account.isNoPresetLimit === true ||
    account.creditLimit === undefined ||
    account.creditLimit === null ||
    account.creditLimit <= 0;

  const balance = Math.max(0, account.currentBalance);

  if (isNoPreset) {
    return {
      accountId: account.id,
      accountName: account.name,
      institution: account.institution,
      currentBalance: balance,
      creditLimit: 0,
      availableCredit: 0,
      utilizationRate: 0,
      status: 'no_limit',
      thresholdBreached: null,
      recommendedPaydownAmount: 0,
      isNoPresetLimit: true,
      paydownWording:
        'No preset spending limit (Charge card) — Utilization metric not applicable. Pay statement in full.',
    };
  }

  const limit = account.creditLimit || 0;
  const rawUtilization = limit > 0 ? (balance / limit) * 100 : 0;
  const utilization = Math.round(rawUtilization * 10) / 10;
  const availableCredit = Math.max(0, limit - balance);

  let status: 'healthy' | 'warning' | 'danger' | 'critical' = 'healthy';
  let thresholdBreached: number | null = null;

  if (utilization >= thresholds.criticalThreshold) {
    status = 'critical';
    thresholdBreached = thresholds.criticalThreshold;
  } else if (utilization >= thresholds.dangerThreshold) {
    status = 'danger';
    thresholdBreached = thresholds.dangerThreshold;
  } else if (utilization >= thresholds.warningThreshold) {
    status = 'warning';
    thresholdBreached = thresholds.warningThreshold;
  }

  // Calculate paydown needed to get down to 29.9% (below warning)
  const targetBalance = limit * (thresholds.warningThreshold / 100);
  const recommendedPaydownAmount = Math.max(0, balance - targetBalance);

  return {
    accountId: account.id,
    accountName: account.name,
    institution: account.institution,
    currentBalance: balance,
    creditLimit: limit,
    availableCredit,
    utilizationRate: utilization,
    status,
    thresholdBreached,
    recommendedPaydownAmount,
    isNoPresetLimit: false,
    paydownWording:
      recommendedPaydownAmount > 0
        ? 'Optional utilization reduction — only after required cash reserves (payroll, bills, tax floor) are confirmed.'
        : 'Utilization within healthy parameters (< 30%).',
  };
}

export function analyzeRevolvingDebt(
  accounts: Account[],
  thresholds: UtilizationThresholds = DEFAULT_THRESHOLDS
): RevolvingDebtSummary {
  const creditAccounts = accounts.filter((a) => a.type === 'credit');
  const reports: CardUtilizationReport[] = [];

  let totalBalance = 0;
  let totalLimit = 0;
  let cardsAboveWarning = 0;
  let cardsAboveDanger = 0;
  let cardsAboveCritical = 0;

  for (const acc of creditAccounts) {
    const report = calculateCardUtilization(acc, thresholds);
    if (report) {
      reports.push(report);
      totalBalance += report.currentBalance;
      if (!report.isNoPresetLimit && report.creditLimit > 0) {
        totalLimit += report.creditLimit;
      }

      if (report.status === 'critical') cardsAboveCritical++;
      if (report.status === 'danger' || report.status === 'critical') cardsAboveDanger++;
      if (report.status !== 'healthy' && report.status !== 'no_limit') cardsAboveWarning++;
    }
  }

  const blendedUtilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

  return {
    totalBalance,
    totalLimit,
    blendedUtilization,
    cardsCount: creditAccounts.length,
    cardsAboveWarning,
    cardsAboveDanger,
    cardsAboveCritical,
    reports,
  };
}

export function analyzeLoans(accounts: Account[]): {
  loans: LoanReport[];
  totalLoanDebt: number;
  totalMonthlyObligation: number;
} {
  const loanAccounts = accounts.filter((a) => a.type === 'loan');
  let totalLoanDebt = 0;
  let totalMonthlyObligation = 0;

  const loans: LoanReport[] = loanAccounts.map((acc) => {
    totalLoanDebt += acc.currentBalance;
    totalMonthlyObligation += acc.monthlyPayment || 0;

    return {
      accountId: acc.id,
      accountName: acc.name,
      institution: acc.institution,
      subtype: acc.subtype,
      remainingBalance: acc.currentBalance,
      interestRate: acc.interestRate,
      monthlyPayment: acc.monthlyPayment,
      maturityDate: acc.maturityDate,
      isStale: acc.isStale,
      staleReason: acc.staleReason,
      lastSyncedAt: acc.lastSyncedAt,
    };
  });

  return {
    loans,
    totalLoanDebt,
    totalMonthlyObligation,
  };
}

export function detectStaleAccounts(
  accounts: Account[],
  thresholdHours: number = 72
): Account[] {
  const cutoff = Date.now() - thresholdHours * 60 * 60 * 1000;
  return accounts.filter((a) => {
    if (a.isStale || a.status === 'sync_error') return true;
    if (!a.lastSyncedAt) return true;
    const syncTime = new Date(a.lastSyncedAt).getTime();
    return isNaN(syncTime) || syncTime < cutoff;
  });
}

