import React from 'react';
import {
  Wallet,
  Landmark,
  CreditCard,
  Building,
  AlertTriangle,
  Flame,
  Calculator,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatPercent } from '../services/normalization';

export const KpiMetricsBar: React.FC = () => {
  const {
    briefing,
    monthlyBurnRate,
    handleInspectMetric,
    accounts,
    activeEntity,
    isDataValid,
  } = useFinancial();

  const { cashSummary, debtSummary } = briefing;

  const totalMonthlyLoanPayments = accounts
    .filter((a) => a.type === 'loan')
    .reduce((sum, a) => sum + (a.monthlyPayment || 0), 0);

  // Entity-specific values
  const displayAvailableCash =
    activeEntity === 'business'
      ? cashSummary.businessAvailableLiquidity ?? cashSummary.availableLiquidity
      : activeEntity === 'personal'
      ? cashSummary.personalAvailableLiquidity ?? 0
      : cashSummary.availableLiquidity;

  const displaySettledCash =
    activeEntity === 'business'
      ? cashSummary.businessSettledCash ?? cashSummary.totalSettledCash
      : activeEntity === 'personal'
      ? cashSummary.personalSettledCash ?? 0
      : cashSummary.totalSettledCash;

  const hasCreditAccounts = accounts.some((a) => a.type === 'credit');
  const hasLoanAccounts = accounts.some((a) => a.type === 'loan');

  return (
    <div className="space-y-2 mb-6">
      {/* Stale Feeds Coverage Warning Alert if detected */}
      {isDataValid && cashSummary.hasStaleFeedsWarning && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 px-3 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Coverage Warning:</strong>{' '}
              {cashSummary.coverageWarning ||
                'One or more connected feeds are stale (>72h). Liquidity calculations exclude unverified funds.'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {cashSummary.dataTimestamp
              ? new Date(cashSummary.dataTimestamp).toLocaleTimeString()
              : 'Recent'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. True Available Cash */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-sm hover:border-slate-700 transition group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span>True Available Cash</span>
              {activeEntity !== 'all' && (
                <span className="text-[9px] uppercase font-bold px-1 rounded bg-slate-800 text-indigo-300">
                  {activeEntity}
                </span>
              )}
            </span>
            {isDataValid && (
              <button
                onClick={() => handleInspectMetric('true_available_cash')}
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-slate-700 hover:border-emerald-500 transition cursor-pointer"
                title="Trace how this number was derived"
              >
                <Calculator className="w-3 h-3" />
                <span>Why?</span>
              </button>
            )}
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight font-mono">
            {isDataValid ? formatCurrency(displayAvailableCash) : '—'}
          </div>
          {!isDataValid ? (
            <div className="text-[11px] text-slate-500 mt-1">Awaiting valid source data</div>
          ) : activeEntity === 'all' ? (
            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
              <span>Biz: {formatCurrency(cashSummary.businessAvailableLiquidity ?? 0)}</span>
              <span>Pers: {formatCurrency(cashSummary.personalAvailableLiquidity ?? 0)}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
              <span>Committed hold:</span>
              <span className="text-amber-400/90 font-medium">
                -{formatCurrency(cashSummary.committedHold)}
              </span>
            </div>
          )}
        </div>

        {/* 2. Total Settled Cash (Book Balance) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-cyan-400" />
              <span>Total Settled Cash</span>
              {activeEntity !== 'all' && (
                <span className="text-[9px] uppercase font-bold px-1 rounded bg-slate-800 text-indigo-300">
                  {activeEntity}
                </span>
              )}
            </span>
            {isDataValid && (
              <button
                onClick={() => handleInspectMetric('total_book_cash')}
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-500 transition cursor-pointer"
                title="Trace how this number was derived"
              >
                <Calculator className="w-3 h-3" />
                <span>Why?</span>
              </button>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-100 tracking-tight font-mono">
            {isDataValid ? formatCurrency(displaySettledCash) : '—'}
          </div>
          {!isDataValid ? (
            <div className="text-[11px] text-slate-500 mt-1">Awaiting valid source data</div>
          ) : activeEntity === 'all' ? (
            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
              <span>Biz: {formatCurrency(cashSummary.businessSettledCash ?? 0)}</span>
              <span>Pers: {formatCurrency(cashSummary.personalSettledCash ?? 0)}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
              <span>Pending inflows:</span>
              <span className="text-emerald-400/90 font-medium">
                +{formatCurrency(briefing.pendingSummary.pendingInflows)}
              </span>
            </div>
          )}
        </div>

        {/* 3. Revolving Credit Debt & Utilization */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>Credit Card Debt</span>
            </span>
            {isDataValid && hasCreditAccounts && (
              <button
                onClick={() => handleInspectMetric('revolving_credit_debt')}
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 hover:bg-amber-600 text-amber-300 hover:text-white border border-slate-700 hover:border-amber-500 transition cursor-pointer"
                title="Trace how this number was derived"
              >
                <Calculator className="w-3 h-3" />
                <span>Why?</span>
              </button>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-100 tracking-tight font-mono">
            {isDataValid && hasCreditAccounts
              ? formatCurrency(debtSummary.totalCreditDebt)
              : '—'}
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
            {!isDataValid || !hasCreditAccounts ? (
              <span className="text-slate-500">
                {!isDataValid ? 'Awaiting valid source data' : 'No credit cards linked'}
              </span>
            ) : (
              <>
                <span>Credit Line:</span>
                <button
                  onClick={() => handleInspectMetric('blended_utilization')}
                  className="hover:underline text-slate-300 font-medium"
                >
                  {formatPercent(debtSummary.blendedUtilization)} util
                </button>
              </>
            )}
          </div>
        </div>

        {/* 4. Commercial Loans Outstanding */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-indigo-400" />
              <span>Term Loan Balance</span>
            </span>
            {isDataValid && briefing.syncHealth.staleCount > 0 && (
              <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1 rounded flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                Feed Stale
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-100 tracking-tight font-mono">
            {isDataValid && hasLoanAccounts
              ? formatCurrency(debtSummary.totalLoanBalance)
              : '—'}
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
            {!isDataValid || !hasLoanAccounts ? (
              <span className="text-slate-500">
                {!isDataValid ? 'Awaiting valid source data' : 'No commercial loans'}
              </span>
            ) : (
              <>
                <span>Monthly Installment:</span>
                <span className="text-slate-300 font-medium">
                  {formatCurrency(totalMonthlyLoanPayments)}/mo
                </span>
              </>
            )}
          </div>
        </div>

        {/* 5. Software & Subscription Burn */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Recurring Monthly Burn</span>
            </span>
            {isDataValid && monthlyBurnRate > 0 && (
              <button
                onClick={() => handleInspectMetric('monthly_burn_rate')}
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 hover:bg-rose-600 text-rose-300 hover:text-white border border-slate-700 hover:border-rose-500 transition cursor-pointer"
                title="Trace how this number was derived"
              >
                <Calculator className="w-3 h-3" />
                <span>Why?</span>
              </button>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-100 tracking-tight font-mono">
            {isDataValid ? (
              <>
                {formatCurrency(monthlyBurnRate)}
                <span className="text-xs text-slate-400 font-normal">/mo</span>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
            {!isDataValid ? (
              <span className="text-slate-500">Awaiting valid source data</span>
            ) : (
              <>
                <span>Next 7d bills:</span>
                <span className="text-amber-400 font-medium">
                  {briefing.upcomingObligations.length} due
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
