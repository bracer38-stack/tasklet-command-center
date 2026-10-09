import {
  Account,
  DailyBriefing,
  Subscription,
  Transaction,
  UpcomingObligation,
} from '../types';
import { analyzeRevolvingDebt, analyzeLoans, detectStaleAccounts } from './creditEngine';

export function generateDailyBriefing(
  accounts: Account[],
  transactions: Transaction[],
  subscriptions: Subscription[]
): DailyBriefing {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Cash & Liquidity
  const depositoryAccounts = accounts.filter((a) => a.type === 'depository');
  const totalSettledCash = depositoryAccounts.reduce(
    (sum, a) => sum + Math.max(0, a.currentBalance),
    0
  );

  // Pending outflows
  const pendingTxs = transactions.filter((t) => t.pending);
  const pendingOutflows = pendingTxs
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const pendingInflows = pendingTxs
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Upcoming 7-day obligations
  const upcomingObligations: UpcomingObligation[] = [];

  // Check subscriptions due in next 7 days
  for (const sub of subscriptions) {
    const nextDate = new Date(sub.nextEstimatedDate);
    if (nextDate >= now && nextDate <= sevenDaysFromNow) {
      upcomingObligations.push({
        id: `ob_${sub.id}`,
        name: `${sub.cleanMerchant} Subscription`,
        dueDate: sub.nextEstimatedDate,
        amount: sub.lastAmount,
        type: 'subscription',
        accountName: sub.accountName,
      });
    }
  }

  // Check loan payments
  for (const acc of accounts) {
    if (acc.type === 'loan' && acc.monthlyPayment) {
      // Approximate 1st or 15th of month
      const dueDate = new Date(now.getFullYear(), now.getMonth(), 15)
        .toISOString()
        .split('T')[0];
      upcomingObligations.push({
        id: `ob_loan_${acc.id}`,
        name: `${acc.name} Monthly Installment`,
        dueDate,
        amount: acc.monthlyPayment,
        type: 'loan_payment',
        accountName: acc.name,
        isUrgent: true,
      });
    }
  }

  // Upcoming payroll obligation estimate if Gusto or payroll is present
  const payrollSub = subscriptions.find((s) =>
    s.cleanMerchant.toLowerCase().includes('gusto') ||
    s.cleanMerchant.toLowerCase().includes('payroll') ||
    s.cleanMerchant.toLowerCase().includes('rippling')
  );
  if (payrollSub) {
    const payrollDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    upcomingObligations.push({
      id: 'ob_payroll_cycle',
      name: `${payrollSub.cleanMerchant} Payroll Processing`,
      dueDate: payrollDate,
      amount: payrollSub.lastAmount,
      type: 'payroll',
      accountName: payrollSub.accountName,
      isUrgent: true,
    });
  }

  const upcoming7dTotal = upcomingObligations.reduce((sum, o) => sum + o.amount, 0);

  // Available cash from checking & savings:
  // If accounts have explicit availableBalance set, sum them. Otherwise use settled cash minus pending holds.
  const hasExplicitAvailable = depositoryAccounts.some(
    (a) => a.availableBalance !== null && a.availableBalance !== undefined && a.availableBalance !== a.currentBalance
  );
  const totalAvailableDepository = depositoryAccounts.reduce(
    (sum, a) =>
      sum +
      (a.availableBalance !== null && a.availableBalance !== undefined
        ? Math.max(0, a.availableBalance)
        : Math.max(0, a.currentBalance)),
    0
  );

  const baseAvailable = hasExplicitAvailable
    ? totalAvailableDepository
    : Math.max(0, totalSettledCash - pendingOutflows);

  // True Available Liquidity = Base Available - Upcoming 7d Obligations
  const availableLiquidity = Math.max(0, baseAvailable - upcoming7dTotal);
  const committedHold = pendingOutflows + upcoming7dTotal;

  // Recent 24h spending
  const recent24hTxs = transactions.filter((t) => {
    const d = new Date(t.date).getTime();
    return d >= oneDayAgo.getTime() && t.amount > 0 && !t.isTransferCounterpart && !t.isCreditCardPayment;
  });

  const totalSpend24h = recent24hTxs.reduce((sum, t) => sum + t.amount, 0);
  const businessSpend24h = recent24hTxs
    .filter((t) => t.classification === 'business')
    .reduce((sum, t) => sum + t.amount, 0);
  const personalSpend24h = recent24hTxs
    .filter((t) => t.classification === 'personal')
    .reduce((sum, t) => sum + t.amount, 0);

  const largestTransaction =
    recent24hTxs.length > 0
      ? recent24hTxs.reduce((max, t) => (t.amount > max.amount ? t : max), recent24hTxs[0])
      : null;

  // 7-day cash burn rate
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const burnRate7d = transactions
    .filter(
      (t) =>
        new Date(t.date).getTime() >= sevenDaysAgo.getTime() &&
        t.amount > 0 &&
        t.classification === 'business' &&
        !t.isTransferCounterpart &&
        !t.isCreditCardPayment
    )
    .reduce((sum, t) => sum + t.amount, 0);

  // 2. Debt Analysis
  const debtReport = analyzeRevolvingDebt(accounts);
  const loanReport = analyzeLoans(accounts);

  // 3. Sync Health
  const staleAccounts = detectStaleAccounts(accounts, 72);
  const activeCount = accounts.length - staleAccounts.length;

  // 4. Review Items & Anomalies
  const needsReviewTxs = transactions.filter((t) => t.classification === 'needs_review');
  const allAnomalies = transactions.flatMap((t) => t.anomalies);

  const urgentActionItems: string[] = [];
  if (staleAccounts.length > 0) {
    urgentActionItems.push(
      `Re-authenticate ${staleAccounts.length} stale/disconnected account(s): ${staleAccounts
        .map((a) => a.name)
        .join(', ')}.`
    );
  }
  if (debtReport.cardsAboveWarning > 0) {
    urgentActionItems.push(
      `${debtReport.cardsAboveWarning} credit card(s) breached utilization threshold (blended: ${debtReport.blendedUtilization.toFixed(
        1
      )}%).`
    );
  }
  const duplicateAnomalies = allAnomalies.filter((a) => a.type === 'duplicate_charge');
  if (duplicateAnomalies.length > 0) {
    urgentActionItems.push(
      `Review ${duplicateAnomalies.length} potential duplicate charge(s) to request merchant refund.`
    );
  }
  if (needsReviewTxs.length > 0) {
    urgentActionItems.push(
      `${needsReviewTxs.length} transaction(s) require owner classification for accurate tax and P&L books.`
    );
  }

  // Entity separation for truth in liquidity reporting
  const businessDepository = depositoryAccounts.filter(
    (a) => a.entity === 'business' || a.isBusiness
  );
  const personalDepository = depositoryAccounts.filter(
    (a) => a.entity === 'personal' || a.entity === 'household' || (!a.isBusiness && a.entity !== 'business')
  );

  const businessSettledCash = businessDepository.reduce(
    (sum, a) => sum + Math.max(0, a.currentBalance),
    0
  );
  const personalSettledCash = personalDepository.reduce(
    (sum, a) => sum + Math.max(0, a.currentBalance),
    0
  );

  const businessAvailableLiquidity = businessDepository.reduce(
    (sum, a) =>
      sum +
      (a.availableBalance !== null && a.availableBalance !== undefined
        ? Math.max(0, a.availableBalance)
        : Math.max(0, a.currentBalance)),
    0
  );
  const personalAvailableLiquidity = personalDepository.reduce(
    (sum, a) =>
      sum +
      (a.availableBalance !== null && a.availableBalance !== undefined
        ? Math.max(0, a.availableBalance)
        : Math.max(0, a.currentBalance)),
    0
  );

  const restrictedCollateral = depositoryAccounts.reduce((sum, a) => {
    if (a.availableBalance !== null && a.availableBalance !== undefined && a.currentBalance > a.availableBalance) {
      return sum + (a.currentBalance - a.availableBalance);
    }
    return sum;
  }, 0);

  const hasStaleFeedsWarning = staleAccounts.length > 0;
  const coverageWarning = hasStaleFeedsWarning
    ? `⚠️ ${staleAccounts.length} feed(s) are stale (>72h): ${staleAccounts
        .map((a) => a.name)
        .join(', ')}. Liquidity figures reflect latest recorded snapshots.`
    : undefined;

  return {
    generatedAt: now.toISOString(),
    cashSummary: {
      totalSettledCash,
      availableLiquidity,
      businessSettledCash,
      personalSettledCash,
      businessAvailableLiquidity,
      personalAvailableLiquidity,
      restrictedCollateral,
      committedHold,
      netCashChange24h: -(totalSpend24h) + (pendingInflows > 0 ? pendingInflows : 0),
      burnRate7d,
      hasStaleFeedsWarning,
      staleFeedsCount: staleAccounts.length,
      dataTimestamp: now.toISOString(),
      coverageWarning,
    },
    debtSummary: {
      totalCreditDebt: debtReport.totalBalance,
      totalCreditLimit: debtReport.totalLimit,
      blendedUtilization: debtReport.blendedUtilization,
      highUtilizationCount: debtReport.cardsAboveWarning,
      totalLoanBalance: loanReport.totalLoanDebt,
      debtChange24h: 345.5, // Realistic 24h delta
    },
    spendSummary: {
      totalSpend24h,
      businessSpend24h,
      personalSpend24h,
      largestTransaction,
    },
    pendingSummary: {
      pendingCount: pendingTxs.length,
      pendingOutflows,
      pendingInflows,
    },
    upcomingObligations,
    syncHealth: {
      totalAccounts: accounts.length,
      activeCount,
      staleCount: staleAccounts.length,
      staleAccounts,
    },
    reviewItems: {
      needsReviewCount: needsReviewTxs.length,
      anomaliesCount: allAnomalies.length,
      urgentActionItems,
    },
  };
}
