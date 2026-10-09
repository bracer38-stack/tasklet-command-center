import {
  Account,
  Transaction,
  Subscription,
  FinancialNote,
  DailyBriefing,
  FinancialDataHealth,
  ReconciliationReport,
  UtilizationThresholds,
} from '../types';
import { formatCurrency, formatPercent } from './normalization';
import { calculateCardUtilization } from './creditEngine';

export interface FinancialContextSnapshot {
  businessName: string;
  dataMode: string;
  accounts: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  notes: FinancialNote[];
  briefing: DailyBriefing;
  dataHealth: FinancialDataHealth;
  latestReconciliationReport: ReconciliationReport | null;
  thresholds: UtilizationThresholds;
}

export type ActionShortcutType =
  | 'navigate_tab'
  | 'open_briefing'
  | 'open_what_changed'
  | 'open_ingest'
  | 'open_recon_report'
  | 'open_audit'
  | 'open_metric'
  | 'filter_transactions'
  | 'batch_classify_personal';

export interface AgentActionShortcut {
  id: string;
  label: string;
  description?: string;
  type: ActionShortcutType;
  targetTab?: string;
  filter?: {
    classification?: string;
    status?: 'all' | 'posted' | 'pending';
    hasAnomalyOnly?: boolean;
    query?: string;
  };
  txId?: string;
  metricKey?: string;
  variant?: 'primary' | 'warning' | 'danger' | 'success' | 'info';
}

export interface MetricSummaryCard {
  title: string;
  value: string;
  subtext?: string;
  status: 'positive' | 'negative' | 'neutral' | 'warning';
}

export interface AgentMessage {
  id: string;
  sender: 'user' | 'agent';
  timestamp: string;
  content: string;
  shortcuts?: AgentActionShortcut[];
  summaryCards?: MetricSummaryCard[];
}

/**
 * Generates an executive summary of everything uploaded to the platform.
 */
export function generateCompleteUploadSummary(snapshot: FinancialContextSnapshot): AgentMessage {
  const {
    businessName,
    accounts,
    transactions,
    briefing,
    subscriptions,
    dataHealth,
    thresholds,
  } = snapshot;

  const depositoryAccounts = accounts.filter((a) => a.type === 'depository');
  const creditAccounts = accounts.filter((a) => a.type === 'credit');
  const loanAccounts = accounts.filter((a) => a.type === 'loan');

  const settledCash = briefing.cashSummary.totalSettledCash;
  const trueAvailableCash = briefing.cashSummary.availableLiquidity;
  const pendingHolds = briefing.pendingSummary.pendingOutflows;
  const committedObligations = briefing.cashSummary.committedHold - pendingHolds;

  const totalCreditDebt = briefing.debtSummary.totalCreditDebt;
  const totalCreditLimit = briefing.debtSummary.totalCreditLimit;
  const blendedUtil = briefing.debtSummary.blendedUtilization;
  const totalLoanDebt = briefing.debtSummary.totalLoanBalance;

  const warningThreshold = thresholds?.warningThreshold ?? (thresholds as any)?.warning ?? 30;
  const highUtilCards = creditAccounts.filter((card) => {
    const report = calculateCardUtilization(card, thresholds);
    return report && report.utilizationRate >= warningThreshold;
  });

  const unreviewedCount = briefing.reviewItems.needsReviewCount;
  const anomaliesCount = briefing.reviewItems.anomaliesCount;
  const staleAccounts = briefing.syncHealth.staleAccounts;

  const summaryCards: MetricSummaryCard[] = [
    {
      title: 'True Available Cash',
      value: formatCurrency(trueAvailableCash),
      subtext: `Book: ${formatCurrency(settledCash)} (minus holds & obligations)`,
      status: trueAvailableCash > 5000 ? 'positive' : trueAvailableCash > 0 ? 'neutral' : 'warning',
    },
    {
      title: 'Revolving Credit Debt',
      value: formatCurrency(totalCreditDebt),
      subtext: `${formatPercent(blendedUtil)} utilization of ${formatCurrency(totalCreditLimit)} limit`,
      status: blendedUtil > 50 ? 'warning' : 'neutral',
    },
    {
      title: 'Needs Review',
      value: `${unreviewedCount + anomaliesCount} items`,
      subtext: `${unreviewedCount} unreviewed • ${anomaliesCount} anomalies`,
      status: unreviewedCount + anomaliesCount > 0 ? 'warning' : 'positive',
    },
    {
      title: 'Ledger Confidence',
      value: `${dataHealth.overallConfidenceScore}%`,
      subtext: `${accounts.length} accounts • ${transactions.length} transactions`,
      status: dataHealth.overallConfidenceScore >= 80 ? 'positive' : 'warning',
    },
  ];

  let body = `### 📊 Complete Upload & Ledger Executive Summary for **${businessName}**\n\n`;

  if (accounts.length === 0 && transactions.length === 0) {
    body += `**Your ledger is currently empty.** No financial accounts or transaction statements are loaded.\n\n` +
      `Click the button below to open the **Statement Ingestion Staging Screen** and upload your bank export or Plaid CSV.`;

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: body,
      summaryCards,
      shortcuts: [
        {
          id: 'sc_ingest',
          label: 'Upload Bank Statement / Plaid CSV',
          description: 'Open the staging screen to ingest records',
          type: 'open_ingest',
          variant: 'primary',
        },
      ],
    };
  }

  body += `Here is the comprehensive audit of all accounts, statements, and records currently active:\n\n`;

  // 1. Accounts & Banking
  body += `#### 1. Accounts & Banking Infrastructure\n` +
    `- **Depository Accounts (${depositoryAccounts.length}):** Book balance of **${formatCurrency(settledCash)}**. ` +
    `Accounting for pending authorizations (-${formatCurrency(pendingHolds)}) and 7-day obligations (-${formatCurrency(committedObligations)}), your **True Available Cash is ${formatCurrency(trueAvailableCash)}**.\n` +
    `- **Credit Cards (${creditAccounts.length}):** Total revolving debt of **${formatCurrency(totalCreditDebt)}** across **${formatCurrency(totalCreditLimit)}** total credit limits (${formatPercent(blendedUtil)} blended utilization).\n` +
    `- **Term Loans (${loanAccounts.length}):** Principal outstanding debt of **${formatCurrency(totalLoanDebt)}**.\n\n`;

  // 2. High utilization or risk
  if (highUtilCards.length > 0) {
    body += `#### ⚠️ Credit Utilization Alert\n` +
      `You have **${highUtilCards.length} card(s)** exceeding your ${formatPercent(warningThreshold)} utilization threshold:\n`;
    highUtilCards.forEach((c) => {
      const report = calculateCardUtilization(c, thresholds);
      const rate = report?.utilizationRate ?? 0;
      body += `  - **${c.name}**: ${formatCurrency(c.currentBalance)} / ${formatCurrency(c.creditLimit || 0)} (**${formatPercent(rate)}**)\n`;
    });
    body += `\n`;
  }

  // 3. Transactions & Ledger Coverage
  body += `#### 2. Transaction Activity & Flow\n` +
    `- Total processed transactions: **${transactions.length}**.\n` +
    `- 24-Hour Net Cash Flow: **${formatCurrency(briefing.cashSummary.netCashChange24h)}**.\n` +
    `- Pending Charges: **${briefing.pendingSummary.pendingCount}** authorizations holding **${formatCurrency(pendingHolds)}**.\n` +
    `- Subscriptions & Recurring Bills: **${subscriptions.length} detected commitments** (totaling ~${formatCurrency(subscriptions.reduce((acc, s) => acc + s.averageAmount, 0))}/month).\n\n`;

  // 4. Data Health & Action Items
  body += `#### 3. Data Integrity & Pending Attention Items\n` +
    `- **Data Health Score:** **${dataHealth.overallConfidenceScore}%** confidence.\n`;
  if (staleAccounts.length > 0) {
    body += `- ⚠️ **Stale Connections:** ${staleAccounts.map((a) => `${a.institution} (${a.name})`).join(', ')} require feed refresh.\n`;
  }
  if (unreviewedCount > 0) {
    body += `- 🔒 **Needs Review:** **${unreviewedCount} transactions** are quarantined in *Needs Review* to prevent P&L skew.\n`;
  }
  if (anomaliesCount > 0) {
    body += `- 🔍 **Anomalies:** **${anomaliesCount} flagged transactions** (potential duplicate swipes, unexpected merchants, or large spikes).\n`;
  }

  const shortcuts: AgentActionShortcut[] = [
    {
      id: 'sc_cards_loans',
      label: 'Open Cards & Loans Center',
      description: 'Inspect individual balances, limits & edit thresholds',
      type: 'navigate_tab',
      targetTab: 'cards-loans',
      variant: 'primary',
    },
    {
      id: 'sc_briefing',
      label: 'View Daily Briefing',
      description: 'Executive 24h recap & upcoming payroll/bills',
      type: 'open_briefing',
      variant: 'info',
    },
  ];

  if (unreviewedCount > 0) {
    shortcuts.push({
      id: 'sc_needs_review',
      label: `Review ${unreviewedCount} Unreviewed Transactions`,
      description: 'Classify transactions safely',
      type: 'filter_transactions',
      targetTab: 'transactions',
      filter: { classification: 'needs_review' },
      variant: 'warning',
    });
  }

  if (anomaliesCount > 0) {
    shortcuts.push({
      id: 'sc_anomalies',
      label: `Triage ${anomaliesCount} Anomalies`,
      description: 'Resolve duplicate swipes and unusual charges',
      type: 'navigate_tab',
      targetTab: 'anomalies',
      variant: 'danger',
    });
  }

  if (staleAccounts.length > 0) {
    shortcuts.push({
      id: 'sc_health',
      label: 'Inspect Data Health & Refresh Feeds',
      description: 'Re-authenticate stale connections',
      type: 'navigate_tab',
      targetTab: 'data-health',
      variant: 'warning',
    });
  }

  return {
    id: `msg_${Date.now()}`,
    sender: 'agent',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    content: body,
    summaryCards,
    shortcuts,
  };
}

/**
 * Generates actionable attention items and prioritized tasks.
 */
export function generateAttentionItems(snapshot: FinancialContextSnapshot): AgentMessage {
  const { accounts, briefing, thresholds, dataHealth } = snapshot;
  const items: string[] = [];
  const shortcuts: AgentActionShortcut[] = [];

  const unreviewedCount = briefing.reviewItems.needsReviewCount;
  const anomaliesCount = briefing.reviewItems.anomaliesCount;
  const staleAccounts = briefing.syncHealth.staleAccounts;

  const creditAccounts = accounts.filter((a) => a.type === 'credit');
  const warningThreshold = thresholds?.warningThreshold ?? (thresholds as any)?.warning ?? 30;
  const highUtilCards = creditAccounts.filter((card) => {
    const report = calculateCardUtilization(card, thresholds);
    return report && report.utilizationRate >= warningThreshold;
  });

  const trueAvailableCash = briefing.cashSummary.availableLiquidity;
  const upcomingBills = briefing.upcomingObligations;

  // 1. Stale Connections
  if (staleAccounts.length > 0) {
    items.push(`**Stale Connection Feeds (${staleAccounts.length}):** ${staleAccounts.map((a) => a.name).join(', ')} have not synced in over 24 hours. Balances may be out of date.`);
    shortcuts.push({
      id: 'sc_stale_conn',
      label: `Re-authenticate ${staleAccounts[0].institution} (${staleAccounts.length} Stale)`,
      description: 'Go to Data Health screen',
      type: 'navigate_tab',
      targetTab: 'data-health',
      variant: 'warning',
    });
  }

  // 2. High Credit Utilization
  if (highUtilCards.length > 0) {
    const names = highUtilCards
      .map((c) => {
        const report = calculateCardUtilization(c, thresholds);
        const rate = report?.utilizationRate ?? 0;
        return `${c.name} (${formatPercent(rate)})`;
      })
      .join(', ');
    items.push(`**High Credit Card Utilization (${highUtilCards.length}):** ${names} exceed your ${formatPercent(warningThreshold)} risk limit.`);
    shortcuts.push({
      id: 'sc_high_util',
      label: 'Open Cards & Loans (Check Limits)',
      description: 'Manage credit line utilization',
      type: 'navigate_tab',
      targetTab: 'cards-loans',
      variant: 'danger',
    });
  }

  // 3. Unreviewed Transactions
  if (unreviewedCount > 0) {
    items.push(`**Quarantined Transactions (${unreviewedCount}):** Unclassified imported items require owner classification to prevent tax and P&L distortion.`);
    shortcuts.push({
      id: 'sc_unreviewed',
      label: `Classify ${unreviewedCount} Needs Review Rows`,
      description: 'Jump to Transactions Hub filtered to Needs Review',
      type: 'filter_transactions',
      targetTab: 'transactions',
      filter: { classification: 'needs_review' },
      variant: 'primary',
    });
  }

  // 4. Financial Anomalies
  if (anomaliesCount > 0) {
    items.push(`**Active Ledger Anomalies (${anomaliesCount}):** Potential duplicate charges or unexpected charges detected.`);
    shortcuts.push({
      id: 'sc_anomalies_triage',
      label: `Review ${anomaliesCount} Anomalies`,
      description: 'Inspect duplicate swipes and spikes',
      type: 'navigate_tab',
      targetTab: 'anomalies',
      variant: 'danger',
    });
  }

  // 5. Cash Liquidity / Upcoming obligations
  if (trueAvailableCash < 3000) {
    items.push(`**Low Liquidity Buffer Warning:** True Available Cash is **${formatCurrency(trueAvailableCash)}**, which provides a thin cushion for short-term obligations.`);
    shortcuts.push({
      id: 'sc_cash_waterfall',
      label: 'View Cash Waterfall on Overview',
      description: 'Inspect committed obligations vs settled cash',
      type: 'navigate_tab',
      targetTab: 'overview',
      variant: 'warning',
    });
  }

  // 6. Upcoming obligations
  if (upcomingBills.length > 0) {
    const nextBill = upcomingBills[0];
    items.push(`**Upcoming Obligations (Next 7 Days):** Next due is **${nextBill.name}** for **${formatCurrency(nextBill.amount)}** on ${nextBill.dueDate}.`);
  }

  let content = '';
  if (items.length === 0) {
    content = `### ✅ All Clear — No Critical Financial Alerts\n\n` +
      `Your finances are looking great:\n` +
      `- All financial institution feeds are synced and healthy.\n` +
      `- Credit utilization across all cards is within safe operating thresholds.\n` +
      `- Zero unreviewed transactions or unresolved anomalies.\n` +
      `- Available liquidity buffer is healthy (**${formatCurrency(trueAvailableCash)}**).\n\n` +
      `Use the shortcuts below to inspect your overview or view recent activity.`;

    shortcuts.push({
      id: 'sc_all_clear_overview',
      label: 'Command Overview',
      type: 'navigate_tab',
      targetTab: 'overview',
      variant: 'primary',
    });
    shortcuts.push({
      id: 'sc_all_clear_briefing',
      label: 'Daily Executive Briefing',
      type: 'open_briefing',
      variant: 'info',
    });
  } else {
    content = `### ⚠️ Immediate Action Items Requiring Attention (${items.length})\n\n` +
      `Here are the highest-priority operational and financial items to address right now:\n\n` +
      items.map((it, idx) => `${idx + 1}. ${it}`).join('\n\n') +
      `\n\nClick any shortcut button below to jump straight to the exact screen in the app.`;
  }

  return {
    id: `msg_${Date.now()}`,
    sender: 'agent',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    content,
    shortcuts,
  };
}

/**
 * Handles freeform financial questions from the user with deep contextual reasoning.
 */
export function answerFinancialQuery(
  rawQuery: string,
  snapshot: FinancialContextSnapshot
): AgentMessage {
  const query = rawQuery.trim().toLowerCase();

  // 1. Upload summary intent
  if (
    query.includes('summar') ||
    query.includes('what is uploaded') ||
    query.includes("what's uploaded") ||
    query.includes('everything uploaded') ||
    query.includes('show me everything') ||
    query.includes('overview of all') ||
    query.includes('breakdown of everything')
  ) {
    return generateCompleteUploadSummary(snapshot);
  }

  // 2. Attention items / what to pay attention to / issues / warnings
  if (
    query.includes('attention') ||
    query.includes('look at') ||
    query.includes('how things are looking') ||
    query.includes('how are things') ||
    query.includes('anything i need to') ||
    query.includes('what should i do') ||
    query.includes('warning') ||
    query.includes('urgent') ||
    query.includes('problem') ||
    query.includes('alert')
  ) {
    return generateAttentionItems(snapshot);
  }

  // 2.5 Batch classify remaining unreviewed as personal intent
  if (
    query.includes('personal') &&
    (query.includes('rest') ||
      query.includes('batch') ||
      query.includes('remaining') ||
      query.includes('mark') ||
      query.includes('label') ||
      query.includes('classify') ||
      query.includes('unreviewed'))
  ) {
    const unreviewedCount = snapshot.briefing.reviewItems.needsReviewCount;
    const businessCount = snapshot.transactions.filter((t) => t.classification === 'business').length;
    const personalCount = snapshot.transactions.filter((t) => t.classification === 'personal').length;

    let content = '';
    const shortcuts: AgentActionShortcut[] = [];

    if (unreviewedCount > 0) {
      content = `### 👤 Batch Reclassification: Mark Remaining as Personal\n\n` +
        `You have verified your **${businessCount} business transactions**.\n\n` +
        `There are currently **${unreviewedCount} unreviewed transaction(s)** in the queue. ` +
        `Batch-classifying them will:\n` +
        `- Set their classification to **Personal Draw (Non-Business)**.\n` +
        `- Keep all **${businessCount} business expenses**, income, transfers, and debt payments intact.\n` +
        `- Partition them completely from business P&L calculation to prevent skew.\n` +
        `- Record a permanent audit trail entry with owner attribution on every transaction.\n\n` +
        `Click the shortcut button below to execute the batch reclassification:`;

      shortcuts.push({
        id: 'sc_exec_batch_personal',
        label: `⚡ Batch Classify ${unreviewedCount} as Personal Draw`,
        description: 'Instantly mark all remaining unreviewed items as personal',
        type: 'batch_classify_personal',
        variant: 'primary',
      });
      shortcuts.push({
        id: 'sc_view_txs_unreviewed',
        label: 'View in Transactions Hub',
        type: 'filter_transactions',
        targetTab: 'transactions',
        filter: { classification: 'needs_review' },
        variant: 'info',
      });
    } else {
      content = `### ✅ All Non-Business Transactions are Already Marked Personal\n\n` +
        `All transactions in your ledger are already verified and classified:\n` +
        `- **Business Transactions:** ${businessCount}\n` +
        `- **Personal Draws / Expenses:** ${personalCount}\n` +
        `- **Unreviewed Queue:** **0 items**\n\n` +
        `Your business P&L and personal distributions are completely partitioned and accurate.`;

      shortcuts.push({
        id: 'sc_view_txs_all',
        label: 'Open Transactions Hub',
        type: 'navigate_tab',
        targetTab: 'transactions',
        variant: 'primary',
      });
      shortcuts.push({
        id: 'sc_view_overview',
        label: 'Command Overview',
        type: 'navigate_tab',
        targetTab: 'overview',
        variant: 'info',
      });
    }

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      shortcuts,
    };
  }

  // 3. Cash / Liquidity / Checking intent
  if (
    query.includes('cash') ||
    query.includes('liquidity') ||
    query.includes('checking') ||
    query.includes('bank balance') ||
    query.includes('settled') ||
    query.includes('burn')
  ) {
    const { cashSummary, pendingSummary } = snapshot.briefing;
    const depository = snapshot.accounts.filter((a) => a.type === 'depository');

    let content = `### 💧 Cash & Liquidity Breakdown\n\n` +
      `- **True Available Cash:** **${formatCurrency(cashSummary.availableLiquidity)}**\n` +
      `- **Total Settled Book Cash:** **${formatCurrency(cashSummary.totalSettledCash)}**\n` +
      `- **Pending Outflow Holds:** **-${formatCurrency(pendingSummary.pendingOutflows)}** (${pendingSummary.pendingCount} charges)\n` +
      `- **Committed 7-Day Obligations:** **-${formatCurrency(cashSummary.committedHold - pendingSummary.pendingOutflows)}**\n\n` +
      `#### Depository Accounts (${depository.length}):\n`;

    depository.forEach((acc) => {
      content += `- **${acc.name}** (${acc.institution}): Settled ${formatCurrency(acc.currentBalance)} | Available ${formatCurrency(acc.availableBalance ?? acc.currentBalance)}\n`;
    });

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      shortcuts: [
        {
          id: 'sc_cash_overview',
          label: 'Inspect Liquidity Waterfall on Overview',
          type: 'navigate_tab',
          targetTab: 'overview',
          variant: 'primary',
        },
        {
          id: 'sc_cards_cash',
          label: 'View All Bank Accounts in Cards & Loans',
          type: 'navigate_tab',
          targetTab: 'cards-loans',
          variant: 'info',
        },
      ],
    };
  }

  // 4. Credit cards / debt / utilization / credit limit intent
  if (
    query.includes('credit') ||
    query.includes('card') ||
    query.includes('utilization') ||
    query.includes('limit') ||
    query.includes('revolving')
  ) {
    const { debtSummary } = snapshot.briefing;
    const cards = snapshot.accounts.filter((a) => a.type === 'credit');

    const warningThreshold = snapshot.thresholds?.warningThreshold ?? (snapshot.thresholds as any)?.warning ?? 30;
    let content = `### 💳 Credit Cards & Utilization Breakdown\n\n` +
      `- **Total Credit Card Debt:** **${formatCurrency(debtSummary.totalCreditDebt)}**\n` +
      `- **Total Available Credit Limit:** **${formatCurrency(debtSummary.totalCreditLimit)}**\n` +
      `- **Blended Utilization:** **${formatPercent(debtSummary.blendedUtilization)}** (Threshold: ${formatPercent(warningThreshold)})\n\n` +
      `#### Card-by-Card Detail:\n`;

    cards.forEach((c) => {
      const report = calculateCardUtilization(c, snapshot.thresholds);
      const rate = report?.utilizationRate ?? 0;
      const isHigh = rate >= warningThreshold;
      const flag = isHigh ? '⚠️ ' : '✅ ';
      content += `- ${flag}**${c.name}** (${c.institution}): Balance ${formatCurrency(c.currentBalance)} / Limit ${formatCurrency(c.creditLimit || 0)} (**${formatPercent(rate)}** util)\n`;
    });

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      shortcuts: [
        {
          id: 'sc_open_cards',
          label: 'Open Cards & Loans Center',
          description: 'Edit card balances, limits, and view utilization thresholds',
          type: 'navigate_tab',
          targetTab: 'cards-loans',
          variant: 'primary',
        },
      ],
    };
  }

  // 5. Loans / Term debt / SBA intent
  if (query.includes('loan') || query.includes('sba') || query.includes('term debt') || query.includes('promissory')) {
    const loans = snapshot.accounts.filter((a) => a.type === 'loan');
    const totalLoanBal = snapshot.briefing.debtSummary.totalLoanBalance;

    let content = `### 🏛️ Commercial Loans & Term Debt\n\n` +
      `- **Total Loan Debt:** **${formatCurrency(totalLoanBal)}** across **${loans.length} active loan(s)**\n\n`;

    if (loans.length === 0) {
      content += `No active term loans or promissory notes found in your ledger.`;
    } else {
      loans.forEach((l) => {
        content += `- **${l.name}** (${l.institution}): Balance ${formatCurrency(l.currentBalance)} | Interest Rate: ${l.interestRate ?? 0}% | Monthly Payment: ${formatCurrency(l.monthlyPayment ?? 0)}\n`;
      });
    }

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      shortcuts: [
        {
          id: 'sc_loans_view',
          label: 'View Loans in Cards & Loans Center',
          type: 'navigate_tab',
          targetTab: 'cards-loans',
          variant: 'primary',
        },
      ],
    };
  }

  // 6. Subscriptions / Recurring bills intent
  if (
    query.includes('subscript') ||
    query.includes('recurring') ||
    query.includes('bill') ||
    query.includes('software') ||
    query.includes('saas')
  ) {
    const subs = snapshot.subscriptions;
    const totalMonthly = subs.reduce((sum, s) => sum + s.averageAmount, 0);

    let content = `### 🔄 Subscriptions & Recurring Bills\n\n` +
      `- **Total Active Subscriptions:** **${subs.length} detected**\n` +
      `- **Estimated Monthly Commitment:** **${formatCurrency(totalMonthly)}/month**\n\n` +
      `#### Upcoming & Active Commitments:\n`;

    subs.slice(0, 8).forEach((s) => {
      content += `- **${s.cleanMerchant}**: ${formatCurrency(s.averageAmount)} (${s.frequency}) • Next: ${s.nextEstimatedDate || 'Scheduled'}\n`;
    });

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      shortcuts: [
        {
          id: 'sc_open_subs',
          label: 'Open Subscriptions View',
          description: 'Manage recurring services & verify cadences',
          type: 'navigate_tab',
          targetTab: 'subscriptions',
          variant: 'primary',
        },
      ],
    };
  }

  // 7. Anomalies / Duplicates / Gary Danko / Unusual charges intent
  if (
    query.includes('anomal') ||
    query.includes('duplicate') ||
    query.includes('unusual') ||
    query.includes('spike') ||
    query.includes('fraud') ||
    query.includes('danko')
  ) {
    const anomaliesCount = snapshot.briefing.reviewItems.anomaliesCount;
    const anomaliesList = snapshot.transactions.filter((t) => t.anomalies.length > 0);

    let content = `### 🔍 Anomalies & Duplicate Detection\n\n` +
      `We found **${anomaliesCount} flagged anomaly items** in your ledger:\n\n`;

    if (anomaliesList.length === 0) {
      content += `✅ No active anomalies detected! All transactions conform to standard spending patterns.`;
    } else {
      anomaliesList.slice(0, 5).forEach((tx) => {
        const reasons = tx.anomalies.map((a) => a.message || (a as any).description).join('; ');
        const merchantName = tx.cleanMerchant || tx.merchantName || 'Unknown Merchant';
        content += `- **${merchantName}** (${formatCurrency(tx.amount)} on ${tx.date}): ${reasons}\n`;
      });
    }

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      shortcuts: [
        {
          id: 'sc_triage_anom',
          label: 'Open Anomalies & Review Hub',
          description: 'Review duplicate swipes and unusual charges',
          type: 'navigate_tab',
          targetTab: 'anomalies',
          variant: 'danger',
        },
      ],
    };
  }

  // 8. Data Health / Sync / Stale feeds intent
  if (
    query.includes('health') ||
    query.includes('sync') ||
    query.includes('stale') ||
    query.includes('fresh') ||
    query.includes('confidence') ||
    query.includes('connection')
  ) {
    const { dataHealth, briefing } = snapshot;

    let content = `### 🩺 Financial Data Health & Connection Status\n\n` +
      `- **Overall Ledger Confidence:** **${dataHealth.overallConfidenceScore}%** (${dataHealth.status.toUpperCase()})\n` +
      `- **Total Recorded Transactions:** ${dataHealth.totalTransactionsRecorded}\n` +
      `- **Active Monitored Accounts:** ${dataHealth.totalActiveAccounts}\n` +
      `- **Unresolved Issues / Flags:** ${dataHealth.unresolvedIssues.length}\n\n`;

    if (dataHealth.institutions.length > 0) {
      content += `#### Institution Breakdown:\n`;
      dataHealth.institutions.forEach((inst) => {
        content += `- **${inst.name}**: ${inst.status.toUpperCase()} (${inst.accountCount} accounts, last sync: ${inst.lastSyncTimestamp})\n`;
      });
      content += `\n`;
    }

    if (briefing.syncHealth.staleAccounts.length > 0) {
      content += `⚠️ **Stale Feeds Detected:**\n`;
      briefing.syncHealth.staleAccounts.forEach((acc) => {
        content += `- **${acc.name}** (${acc.institution}): Last synced ${acc.lastSyncedAt}\n`;
      });
    }

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      shortcuts: [
        {
          id: 'sc_health_tab',
          label: 'Open Data Health & Integrity View',
          type: 'navigate_tab',
          targetTab: 'data-health',
          variant: 'primary',
        },
      ],
    };
  }

  // 9. Specific Institution queries (e.g. Chase, Bank of America, Amex, Mercury)
  const matchedAccount = snapshot.accounts.find((a) =>
    query.includes(a.name.toLowerCase()) ||
    query.includes(a.institution.toLowerCase()) ||
    (a.mask && query.includes(a.mask))
  );

  if (matchedAccount) {
    const accTxs = snapshot.transactions.filter(
      (t) => t.accountId === matchedAccount.id || t.accountName.toLowerCase() === matchedAccount.name.toLowerCase()
    );

    let content = `### 🏦 Details for **${matchedAccount.name}** (${matchedAccount.institution})\n\n` +
      `- **Type:** ${matchedAccount.type.toUpperCase()} (${matchedAccount.subtype})\n` +
      `- **Current Balance:** **${formatCurrency(matchedAccount.currentBalance)}**\n`;

    if (matchedAccount.creditLimit) {
      const report = calculateCardUtilization(matchedAccount, snapshot.thresholds);
      const rate = report?.utilizationRate ?? 0;
      content += `- **Credit Limit:** ${formatCurrency(matchedAccount.creditLimit)} (**${formatPercent(rate)}** utilization)\n`;
    }
    if (matchedAccount.availableBalance !== undefined) {
      content += `- **Available Funds:** ${formatCurrency(matchedAccount.availableBalance)}\n`;
    }
    content += `- **Transactions on Record:** ${accTxs.length}\n` +
      `- **Last Synced:** ${matchedAccount.lastSyncedAt}\n`;

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      shortcuts: [
        {
          id: 'sc_match_acc',
          label: `Open ${matchedAccount.name} in Cards & Loans`,
          type: 'navigate_tab',
          targetTab: 'cards-loans',
          variant: 'primary',
        },
        {
          id: 'sc_match_txs',
          label: `View ${matchedAccount.name} Transactions`,
          type: 'filter_transactions',
          targetTab: 'transactions',
          filter: { query: matchedAccount.name },
          variant: 'info',
        },
      ],
    };
  }

  // 10. Default General Advisory
  const { briefing } = snapshot;
  const content = `### 💡 Tasklet Financial Copilot\n\n` +
    `I evaluated your question: **"${rawQuery}"** against all live accounts and transactions.\n\n` +
    `Here is a snapshot of current operations for **${snapshot.businessName}**:\n` +
    `- **True Available Cash:** **${formatCurrency(briefing.cashSummary.availableLiquidity)}** (Depository: ${formatCurrency(briefing.cashSummary.totalSettledCash)})\n` +
    `- **Revolving Card Debt:** **${formatCurrency(briefing.debtSummary.totalCreditDebt)}** (${formatPercent(briefing.debtSummary.blendedUtilization)} utilization)\n` +
    `- **Items Needing Attention:** **${briefing.reviewItems.needsReviewCount + briefing.reviewItems.anomaliesCount}**\n` +
    `- **Ledger Health Score:** **${snapshot.dataHealth.overallConfidenceScore}%**\n\n` +
    `You can ask me to:\n` +
    `- *"Summarize everything that's uploaded"*\n` +
    `- *"What needs my attention right now?"*\n` +
    `- *"How is my cash flow looking?"*\n` +
    `- *"Check my credit card utilization and limits"*\n` +
    `- *"Review my subscriptions"*\n` +
    `- *"Check Bank of America or Chase"*\n\n` +
    `Or use the shortcut buttons below to jump directly to any area of the dashboard:`;

  return {
    id: `msg_${Date.now()}`,
    sender: 'agent',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    content,
    shortcuts: [
      {
        id: 'sc_def_summary',
        label: 'Summarize Everything Uploaded',
        type: 'navigate_tab',
        targetTab: 'overview',
        variant: 'primary',
      },
      {
        id: 'sc_def_cards',
        label: 'Cards & Loans Center',
        type: 'navigate_tab',
        targetTab: 'cards-loans',
        variant: 'info',
      },
      {
        id: 'sc_def_briefing',
        label: 'Daily Executive Briefing',
        type: 'open_briefing',
        variant: 'success',
      },
    ],
  };
}
