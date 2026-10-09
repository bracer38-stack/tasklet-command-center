import React, { useState } from 'react';
import {
  X,
  FileText,
  Copy,
  Check,
  Download,
  Wallet,
  CreditCard,
  Flame,
  Clock,
  AlertTriangle,
  Building,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatPercent, formatDate } from '../services/normalization';

interface DailyBriefingModalProps {
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DailyBriefingModal: React.FC<DailyBriefingModalProps> = ({
  onClose,
  onNavigateTab,
}) => {
  const { briefing, businessName } = useFinancial();
  const [copied, setCopied] = useState(false);

  const {
    cashSummary,
    debtSummary,
    spendSummary,
    pendingSummary,
    upcomingObligations,
    syncHealth,
    reviewItems,
  } = briefing;

  const generateMarkdownReport = (): string => {
    return `# TASKLET FINANCIAL COMMAND CENTER - DAILY BRIEFING
Date: ${new Date(briefing.generatedAt).toLocaleDateString()} ${new Date(briefing.generatedAt).toLocaleTimeString()}
Entity: ${businessName}

==================================================
1. CASH & LIQUIDITY
--------------------------------------------------
- True Available Cash: ${formatCurrency(cashSummary.availableLiquidity)}
- Total Depository Book Cash: ${formatCurrency(cashSummary.totalSettledCash)}
- 7-Day Committed Hold: ${formatCurrency(cashSummary.committedHold)}
- Net Cash Change (24h): ${formatCurrency(cashSummary.netCashChange24h)}
- 7-Day Business Cash Burn: ${formatCurrency(cashSummary.burnRate7d)}

==================================================
2. DEBT & UTILIZATION
--------------------------------------------------
- Total Revolving Credit Debt: ${formatCurrency(debtSummary.totalCreditDebt)}
- Total Credit Line: ${formatCurrency(debtSummary.totalCreditLimit)}
- Blended Utilization: ${formatPercent(debtSummary.blendedUtilization)}
- Cards Above Warning (>30%): ${debtSummary.highUtilizationCount} card(s)
- Total Commercial Loan Principal: ${formatCurrency(debtSummary.totalLoanBalance)}

==================================================
3. RECENT SPENDING (24H)
--------------------------------------------------
- Total Spend: ${formatCurrency(spendSummary.totalSpend24h)}
  * Business Deductible: ${formatCurrency(spendSummary.businessSpend24h)}
  * Personal Draw: ${formatCurrency(spendSummary.personalSpend24h)}
- Largest Single Transaction: ${
      spendSummary.largestTransaction
        ? `${spendSummary.largestTransaction.cleanMerchant} - ${formatCurrency(
            spendSummary.largestTransaction.amount
          )} (${spendSummary.largestTransaction.accountName})`
        : 'None'
    }

==================================================
4. PENDING CHARGES & HOLDS
--------------------------------------------------
- Pending Count: ${pendingSummary.pendingCount}
- Pending Outflows (Holds): ${formatCurrency(pendingSummary.pendingOutflows)}
- Pending Inflows (Unsettled): ${formatCurrency(pendingSummary.pendingInflows)}

==================================================
5. UPCOMING OBLIGATIONS (NEXT 7 DAYS)
--------------------------------------------------
${
  upcomingObligations.length === 0
    ? 'No immediate obligations due in the next 7 days.'
    : upcomingObligations
        .map(
          (ob) =>
            `- [${ob.dueDate}] ${ob.name}: ${formatCurrency(ob.amount)} (${ob.accountName})`
        )
        .join('\n')
}

==================================================
6. SYNC FAILURES & DATA FEEDS
--------------------------------------------------
- Total Accounts: ${syncHealth.totalAccounts} (Active: ${syncHealth.activeCount}, Stale/Failed: ${syncHealth.staleCount})
${
  syncHealth.staleAccounts.length === 0
    ? '- All bank feeds operating normally.'
    : syncHealth.staleAccounts
        .map(
          (acc) =>
            `- [STALE] ${acc.name} (${acc.institution}): ${
              acc.staleReason || 'Last sync > 72h ago. Feed re-auth required.'
            }`
        )
        .join('\n')
}

==================================================
7. ITEMS REQUIRING OWNER REVIEW
--------------------------------------------------
- Unclassified Transactions: ${reviewItems.needsReviewCount}
- Flagged Anomalies: ${reviewItems.anomaliesCount}
${
  reviewItems.urgentActionItems.length === 0
    ? '- No open review flags.'
    : reviewItems.urgentActionItems.map((item) => `- ${item}`).join('\n')
}
`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateMarkdownReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = generateMarkdownReport();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tasklet_Financial_Briefing_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Daily Executive Financial Briefing
              </h2>
              <span className="text-xs text-slate-400">
                Generated {new Date(briefing.generatedAt).toLocaleDateString()} for Company Ownership
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Markdown</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export TXT</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Briefing Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Section 1: Cash Changes */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-400" />
                1. Cash Position & Overnight Changes
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {formatCurrency(cashSummary.availableLiquidity)} True Available
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Book Cash:</span>
                <div className="font-mono font-bold text-slate-200">
                  {formatCurrency(cashSummary.totalSettledCash)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Committed Hold:</span>
                <div className="font-mono font-bold text-amber-400">
                  -{formatCurrency(cashSummary.committedHold)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase">24h Net Delta:</span>
                <div
                  className={`font-mono font-bold ${
                    cashSummary.netCashChange24h >= 0 ? 'text-emerald-400' : 'text-slate-300'
                  }`}
                >
                  {formatCurrency(cashSummary.netCashChange24h)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase">7d Burn Rate:</span>
                <div className="font-mono font-bold text-rose-300">
                  {formatCurrency(cashSummary.burnRate7d)}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Debt Changes */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-400" />
                2. Debt Changes & Card Utilization
              </span>
              <span
                className={`font-mono font-bold text-xs ${
                  debtSummary.blendedUtilization >= 30 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {formatPercent(debtSummary.blendedUtilization)} Blended Util
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Revolving Debt:</span>
                <div className="font-mono font-bold text-slate-200">
                  {formatCurrency(debtSummary.totalCreditDebt)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Commercial Loans:</span>
                <div className="font-mono font-bold text-slate-200">
                  {formatCurrency(debtSummary.totalLoanBalance)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Over-Threshold Cards:</span>
                <div className="font-mono font-bold text-amber-300">
                  {debtSummary.highUtilizationCount} card(s) &gt; 30%
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: New Spending (Past 24h) */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-rose-400" />
                3. Recent Spending Breakdown (24h)
              </span>
              <span className="font-mono text-slate-200 font-bold">
                {formatCurrency(spendSummary.totalSpend24h)} total
              </span>
            </div>
            <div className="text-xs text-slate-300 space-y-1">
              <div>
                Business Operating: <strong>{formatCurrency(spendSummary.businessSpend24h)}</strong> • Personal Draw: <strong>{formatCurrency(spendSummary.personalSpend24h)}</strong>
              </div>
              {spendSummary.largestTransaction && (
                <div className="text-[11px] text-slate-400 mt-1">
                  Largest Purchase: <strong>{spendSummary.largestTransaction.cleanMerchant}</strong> (
                  {formatCurrency(spendSummary.largestTransaction.amount)}) on{' '}
                  {spendSummary.largestTransaction.accountName}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Upcoming 7-Day Obligations */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" />
                4. Upcoming Obligations (Next 7 Days)
              </span>
              <span className="text-xs text-amber-400 font-mono font-semibold">
                {upcomingObligations.length} obligations
              </span>
            </div>
            <div className="space-y-2">
              {upcomingObligations.map((ob) => (
                <div
                  key={ob.id}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-200">{ob.name}</div>
                    <div className="text-[10px] text-slate-400">
                      Due: {ob.dueDate} • {ob.accountName}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-100">
                    {formatCurrency(ob.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Sync Failures & Stale Feeds */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                5. Connection Feeds & Sync Health
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {syncHealth.activeCount}/{syncHealth.totalAccounts} Healthy
              </span>
            </div>
            {syncHealth.staleAccounts.length > 0 ? (
              <div className="space-y-2">
                {syncHealth.staleAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold">{acc.name} ({acc.institution})</div>
                      <div className="text-[11px] text-rose-300">
                        {acc.staleReason || 'Last sync > 72 hours ago. Credential update required.'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateTab('cards-loans');
                      }}
                      className="px-2 py-1 rounded text-[10px] font-semibold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer"
                    >
                      Resolve Feed
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                <span>All bank and credit feeds are functioning normally with zero stale alerts.</span>
              </div>
            )}
          </div>

          {/* Section 6: Action Items Requiring Review */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                6. Action Items Requiring Review
              </span>
              <button
                onClick={() => {
                  onClose();
                  onNavigateTab('anomalies');
                }}
                className="text-xs text-indigo-400 hover:underline font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Open Triage Inbox</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <ul className="space-y-1.5">
              {reviewItems.urgentActionItems.map((item, idx) => (
                <li
                  key={idx}
                  className="text-xs text-slate-300 p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center space-x-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Tasklet Financial Command Center • Production Prototype
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
