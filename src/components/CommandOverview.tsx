import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  ArrowDownRight,
  TrendingDown,
  Layers,
  CheckCircle,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatPercent } from '../services/normalization';
import { calculateCardUtilization } from '../services/creditEngine';

interface CommandOverviewProps {
  onNavigateTab: (tab: string) => void;
  onOpenAudit: (txId: string) => void;
  onOpenIngest?: () => void;
}

export const CommandOverview: React.FC<CommandOverviewProps> = ({
  onNavigateTab,
  onOpenAudit,
  onOpenIngest,
}) => {
  const {
    accounts,
    transactions,
    briefing,
    thresholds,
    handleResolveStaleAccount,
    isDataValid,
  } = useFinancial();

  const creditAccounts = accounts.filter((a) => a.type === 'credit');
  const depositoryAccounts = accounts.filter((a) => a.type === 'depository');
  const loanAccounts = accounts.filter((a) => a.type === 'loan');

  const staleAccounts = briefing.syncHealth.staleAccounts;
  const reviewCount = briefing.reviewItems.needsReviewCount + briefing.reviewItems.anomaliesCount;

  // Recent 6 transactions
  const recentTransactions = transactions.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Empty State Banner (if ledger is empty) */}
      {accounts.length === 0 && (
        <div className="bg-slate-900 border border-dashed border-indigo-500/40 rounded-2xl p-8 text-center space-y-4 animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
            <Upload className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-100">
              Ready for Ingestion (0 Accounts Loaded)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Your ledger is clean and ready. Click below to upload your bank CSV statement or Plaid export. Records will pass through the read-only staging verification screen before anything is committed to your dashboard.
            </p>
          </div>
          <div className="flex items-center justify-center pt-2">
            {onOpenIngest && (
              <button
                onClick={onOpenIngest}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-400/30 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Statement / Plaid CSV</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. High Priority Action Center Banner */}
      {isDataValid && (staleAccounts.length > 0 || reviewCount > 0 || briefing.debtSummary.highUtilizationCount > 0) && (
        <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-xl p-4 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-300">
                  Command Attention Required ({briefing.reviewItems.urgentActionItems.length} Key Alerts)
                </h3>
                <ul className="mt-1 space-y-1">
                  {briefing.reviewItems.urgentActionItems.map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end md:self-center">
              {staleAccounts.length > 0 && (
                <button
                  onClick={() => handleResolveStaleAccount(staleAccounts[0].id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition cursor-pointer"
                >
                  Re-auth {staleAccounts[0].institution} Feed
                </button>
              )}
              <button
                onClick={() => onNavigateTab('anomalies')}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
              >
                <span>Triage Anomalies</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Cash Waterfall & Liquidity Clarity */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Liquidity Waterfall (True Available Cash vs. Book Balance)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Distinguishing settled cash from committed obligations prevents accidental overdrafts and payroll shortfalls.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDataValid && briefing.cashSummary.hasStaleFeedsWarning && (
              <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Stale Feed Warning</span>
              </span>
            )}
            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
              isDataValid
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-slate-400 bg-slate-800 border-slate-700'
            }`}>
              {isDataValid ? 'Verified Liquidity' : 'Awaiting Source Records'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
          {/* Step 1: Book Cash */}
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              1. Depository Book Cash
            </span>
            <div className="text-lg font-bold text-slate-100 mt-1 font-mono">
              {isDataValid ? formatCurrency(briefing.cashSummary.totalSettledCash) : '—'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              {isDataValid ? (
                `Biz: ${formatCurrency(briefing.cashSummary.businessSettledCash ?? 0)} • Pers: ${formatCurrency(briefing.cashSummary.personalSettledCash ?? 0)}`
              ) : (
                'Awaiting valid source data'
              )}
            </div>
          </div>

          {/* Step 2: Restricted Collateral & Reserves */}
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>2. Restricted Collateral</span>
              <ShieldAlert className="w-3 h-3 text-amber-400" />
            </span>
            <div className="text-lg font-bold text-amber-400 mt-1 font-mono">
              {isDataValid ? `-${formatCurrency(briefing.cashSummary.restrictedCollateral ?? 0)}` : '—'}
            </div>
            <span className="text-[10px] text-slate-500">
              {isDataValid ? 'Pledged loan collateral & reserve floors' : 'Awaiting valid source data'}
            </span>
          </div>

          {/* Step 3: Pending Outflow Holds */}
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>3. Pending Holds</span>
              <TrendingDown className="w-3 h-3 text-rose-400" />
            </span>
            <div className="text-lg font-bold text-rose-400 mt-1 font-mono">
              {isDataValid ? `-${formatCurrency(briefing.pendingSummary.pendingOutflows)}` : '—'}
            </div>
            <span className="text-[10px] text-slate-500">
              {isDataValid ? `${briefing.pendingSummary.pendingCount} charges authorized` : 'Awaiting valid source data'}
            </span>
          </div>

          {/* Step 4: Upcoming 7-Day Obligations */}
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>4. 7-Day Obligations</span>
              <ArrowDownRight className="w-3 h-3 text-amber-400" />
            </span>
            <div className="text-lg font-bold text-amber-400 mt-1 font-mono">
              {isDataValid ? `-${formatCurrency(briefing.cashSummary.committedHold - briefing.pendingSummary.pendingOutflows)}` : '—'}
            </div>
            <span className="text-[10px] text-slate-500">
              {isDataValid ? `${briefing.upcomingObligations.length} bills / payroll due` : 'Awaiting valid source data'}
            </span>
          </div>

          {/* Step 5: True Available Cash */}
          <div className="p-3 bg-emerald-950/20 rounded-lg border border-emerald-500/30">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              = True Available Cash
            </span>
            <div className="text-xl font-extrabold text-emerald-300 mt-1 font-mono">
              {isDataValid ? formatCurrency(briefing.cashSummary.availableLiquidity) : '—'}
            </div>
            <div className="text-[10px] text-emerald-400/90 font-mono mt-0.5">
              {isDataValid ? (
                `Biz: ${formatCurrency(briefing.cashSummary.businessAvailableLiquidity ?? 0)} • Pers: ${formatCurrency(briefing.cashSummary.personalAvailableLiquidity ?? 0)}`
              ) : (
                'Awaiting valid source data'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Cards & Accounts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credit Cards & Utilization */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Credit Card Utilization & Limits
              </h3>
              <p className="text-xs text-slate-400">
                Thresholds: Warning at {thresholds.warningThreshold}%, Danger at {thresholds.dangerThreshold}%
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('cards-loans')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Limits</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {creditAccounts.map((acc) => {
              const report = calculateCardUtilization(acc, thresholds);
              if (!report) return null;

              const isNpsl = report.isNoPresetLimit;
              const isWarning = report.status === 'warning';
              const isDanger = report.status === 'danger' || report.status === 'critical';

              return (
                <div
                  key={acc.id}
                  className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-200">{acc.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">••{acc.mask}</span>
                      {!acc.isBusiness ? (
                        <span className="text-[9px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-1 rounded">
                          Personal
                        </span>
                      ) : (
                        <span className="text-[9px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-1 rounded">
                          Business
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-medium text-slate-200">
                        {formatCurrency(report.currentBalance)}
                      </span>
                      {isNpsl ? (
                        <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.2 rounded">
                          Charge Card (NPSL)
                        </span>
                      ) : (
                        <>
                          <span className="text-slate-500">/</span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {formatCurrency(report.creditLimit)}
                          </span>
                          <span
                            className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                              isDanger
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : isWarning
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            {formatPercent(report.utilizationRate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Utilization Progress Bar */}
                  {!isNpsl ? (
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isDanger
                            ? 'bg-rose-500'
                            : isWarning
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, report.utilizationRate)}%` }}
                      />
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 bg-slate-900/60 px-2 py-1 rounded border border-slate-800">
                      Statement balance due monthly in full. Excluded from blended revolving ratio.
                    </div>
                  )}

                  {report.recommendedPaydownAmount > 0 && (
                    <div className="mt-2 text-[10px] text-amber-300 flex items-center justify-between">
                      <span>Advice:</span>
                      <span className="font-medium">
                        Optional reduction: Pay {formatCurrency(report.recommendedPaydownAmount)} after confirming payroll & reserves.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Depository Cash Accounts & Loans */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Operating Cash & Commercial Loans
              </h3>
              <p className="text-xs text-slate-400">
                Depository bank feeds and term financing
              </p>
            </div>
            <span className="text-[10px] text-slate-400">
              {depositoryAccounts.length + loanAccounts.length} Feeds
            </span>
          </div>

          <div className="space-y-3">
            {/* Depository Accounts */}
            {depositoryAccounts.map((acc) => {
              const restrictedAmt =
                acc.availableBalance !== null &&
                acc.availableBalance !== undefined &&
                acc.currentBalance > acc.availableBalance
                  ? acc.currentBalance - acc.availableBalance
                  : 0;

              return (
                <div
                  key={acc.id}
                  className={`p-3 rounded-lg border transition ${
                    acc.isStale
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                  } flex items-center justify-between`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-xs text-slate-200">{acc.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">••{acc.mask}</span>
                      <span className="text-[9px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1 rounded">
                        {acc.institution}
                      </span>
                      {acc.isBusiness ? (
                        <span className="text-[9px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-1 rounded">
                          Business Ops
                        </span>
                      ) : (
                        <span className="text-[9px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-1 rounded">
                          Household
                        </span>
                      )}
                      {restrictedAmt > 0 && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded flex items-center gap-0.5">
                          🔒 Restricted: -{formatCurrency(restrictedAmt)}
                        </span>
                      )}
                      {acc.isStale && (
                        <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1 rounded flex items-center gap-0.5">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          Reconnect Required
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>Available: <strong className="text-slate-200">{formatCurrency(acc.availableBalance)}</strong></span>
                      {acc.subtype === 'savings' && <span className="text-slate-500">• Savings</span>}
                      {acc.subtype === 'checking' && <span className="text-slate-500">• Checking</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="text-sm font-bold text-slate-100 font-mono">
                      {formatCurrency(acc.currentBalance)}
                    </div>
                    {acc.isStale ? (
                      <span className="text-[10px] text-amber-400 flex items-center gap-0.5 justify-end">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Stale Feed
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 justify-end">
                        <CheckCircle className="w-2.5 h-2.5" />
                        Synced
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loan Accounts */}
            {loanAccounts.map((loan) => (
              <div
                key={loan.id}
                className={`p-3 rounded-lg border ${
                  loan.isStale
                    ? 'bg-rose-950/20 border-rose-500/30'
                    : 'bg-slate-950/50 border-slate-800/80'
                } flex items-center justify-between`}
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-slate-200">{loan.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">••{loan.mask}</span>
                    {loan.isStale && (
                      <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1 rounded flex items-center gap-0.5">
                        <ShieldAlert className="w-2.5 h-2.5" />
                        Stale Feed
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    APR: {loan.interestRate}% • Payment: {formatCurrency(loan.monthlyPayment || 0)}/mo
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-rose-300 font-mono">
                    {formatCurrency(loan.currentBalance)}
                  </div>
                  {loan.isStale ? (
                    <button
                      onClick={() => handleResolveStaleAccount(loan.id)}
                      className="text-[10px] text-rose-400 hover:underline font-medium cursor-pointer"
                    >
                      Re-auth feed
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400">Active</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Recent Financial Activity Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Recent Feed Activity & Classification Audit
            </h3>
            <p className="text-xs text-slate-400">
              Each transaction includes an audit trail explaining why it was classified and whether it impacts P&L.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>View All Transactions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Merchant / Description</th>
                <th className="py-2 px-3">Account</th>
                <th className="py-2 px-3">Classification</th>
                <th className="py-2 px-3 text-right">Amount</th>
                <th className="py-2 px-3 text-center">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentTransactions.map((tx) => {
                const isInflow = tx.amount < 0;
                const hasAnomalies = tx.anomalies.length > 0;

                return (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {tx.date}
                      {tx.pending && (
                        <span className="ml-1.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-200">{tx.cleanMerchant}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-xs">
                        {tx.rawDescription}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                      {tx.accountName}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          tx.classification === 'business'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : tx.classification === 'income'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : tx.classification === 'transfer'
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                            : tx.classification === 'debt_payment'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : tx.classification === 'personal'
                            ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                            : tx.classification === 'reimbursement'
                            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}
                      >
                        {tx.classification.replace('_', ' ')}
                      </span>
                      {hasAnomalies && (
                        <span className="ml-1 text-[10px] text-amber-400 font-bold" title={tx.anomalies[0].message}>
                          ⚠️
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-medium whitespace-nowrap ${
                        isInflow ? 'text-emerald-400' : 'text-slate-100'
                      }`}
                    >
                      {isInflow ? '+' : ''}
                      {formatCurrency(Math.abs(tx.amount))}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => onOpenAudit(tx.id)}
                        className="px-2 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-slate-700 transition cursor-pointer"
                        title="View audit trail and reasoning"
                      >
                        Why?
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
