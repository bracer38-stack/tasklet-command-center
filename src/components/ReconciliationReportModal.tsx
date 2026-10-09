import React from 'react';
import {
  X,
  FileCheck2,
  Sparkles,
  RefreshCw,
  ArrowRightLeft,
  CreditCard,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Building,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { ReconciliationReport } from '../types';
import { formatCurrency, formatDate } from '../services/normalization';

interface ReconciliationReportModalProps {
  report: ReconciliationReport | null;
  onClose: () => void;
  onOpenAudit: (txId: string) => void;
}

export const ReconciliationReportModal: React.FC<ReconciliationReportModalProps> = ({
  report,
  onClose,
  onOpenAudit,
}) => {
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Plaid Ingestion Reconciliation Report
              </h2>
              <span className="text-xs text-slate-400">
                Batch ID: <code className="text-slate-300 font-mono">{report.batchId}</code> • Generated {new Date(report.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">New Transactions</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                +{report.newTransactions.length}
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Promoted (Pending &rarr; Posted)</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                {report.pendingToPosted.length}
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Matched Transfers & Debt</span>
              <div className="text-xl font-bold text-indigo-400 mt-1">
                {report.matchedTransfers.length + report.matchedCreditCardPayments.length} pairs
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Needs Review Quarantine</span>
              <div className="text-xl font-bold text-amber-400 mt-1">
                {report.needsReviewTransactions.length}
              </div>
            </div>
          </div>

          {/* 1. Pending Transactions Converted to Posted */}
          {report.pendingToPosted.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pending Authorizations Converted to Posted ({report.pendingToPosted.length})</span>
              </h3>
              <div className="space-y-2">
                {report.pendingToPosted.map((promo) => (
                  <div
                    key={promo.postedTxId}
                    className="p-3 rounded-lg bg-slate-950/70 border border-cyan-500/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">{promo.finalName}</div>
                      <div className="text-[11px] text-slate-400">
                        Pre-auth hold: {formatCurrency(promo.originalHoldAmount)} &rarr; Final settled: {formatCurrency(promo.finalSettledAmount)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-200">
                        {formatCurrency(promo.finalSettledAmount)}
                      </div>
                      {Math.abs(promo.amountDelta) > 0.01 && (
                        <span className="text-[10px] text-amber-400 font-mono">
                          Tip/Delta: +{formatCurrency(promo.amountDelta)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Modified Transactions */}
          {report.modifiedTransactions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Modified Transactions ({report.modifiedTransactions.length})</span>
              </h3>
              <div className="space-y-2">
                {report.modifiedTransactions.map((mod) => (
                  <div
                    key={mod.txId}
                    className="p-3 rounded-lg bg-slate-950/70 border border-amber-500/30 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-200">
                      <span>Transaction ID: {mod.txId}</span>
                      <span className="font-mono text-amber-300">Updated</span>
                    </div>
                    <ul className="text-[11px] text-slate-300 space-y-0.5">
                      {mod.changes.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Removed / Reversed Transactions */}
          {report.removedOrReversed.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Removed / Reversed Transactions ({report.removedOrReversed.length})</span>
              </h3>
              <div className="space-y-2">
                {report.removedOrReversed.map((rem) => (
                  <div
                    key={rem.txId}
                    className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-rose-200">Transaction ID: {rem.txId}</div>
                      <div className="text-[11px] text-rose-300">{rem.reason} • {rem.accountName}</div>
                    </div>
                    <span className="font-mono font-bold text-rose-300">
                      {formatCurrency(rem.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Matched Transfers & Credit Card Payments */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
              <span>Matched Internal Transfers & Debt Payments ({report.matchedTransfers.length + report.matchedCreditCardPayments.length})</span>
            </h3>
            <div className="space-y-2">
              {report.matchedTransfers.map((t, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-0.5 rounded font-bold">
                      INTERNAL TRANSFER
                    </span>
                    <span className="text-slate-200">
                      {t.outflowAccount} &rarr; {t.inflowAccount}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-100">
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              ))}

              {report.matchedCreditCardPayments.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold">
                      CARD BILL PAYMENT
                    </span>
                    <span className="text-slate-200">
                      {p.checkingAccount} &rarr; {p.creditCardAccount}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-100">
                    {formatCurrency(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Account Balance Changes */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-400" />
              <span>Account Balance Deltas</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {report.balanceChanges.map((bc) => (
                <div
                  key={bc.accountId}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-200">{bc.accountName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Previous: {formatCurrency(bc.oldCurrent)} &rarr; Current: {formatCurrency(bc.newCurrent)}
                    </div>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      bc.delta > 0 ? 'text-emerald-400' : bc.delta < 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    {bc.delta > 0 ? '+' : ''}
                    {formatCurrency(bc.delta)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
          >
            Dismiss Report
          </button>
        </div>
      </div>
    </div>
  );
};
