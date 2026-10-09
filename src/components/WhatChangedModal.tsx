import React from 'react';
import {
  X,
  GitCompare,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatDate } from '../services/normalization';

interface WhatChangedModalProps {
  onClose: () => void;
  onOpenAudit: (txId: string) => void;
}

export const WhatChangedModal: React.FC<WhatChangedModalProps> = ({
  onClose,
  onOpenAudit,
}) => {
  const { latestDiff, handleSyncNow, isSyncing, lastSyncTime } = useFinancial();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                What Changed Since Last Sync?
              </h2>
              <span className="text-xs text-slate-400">
                Audit delta comparing previous sync against current bank feeds
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Sync Trigger Banner */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs space-y-0.5">
              <div className="font-semibold text-slate-200">
                Feed Status: Active
              </div>
              <div className="text-slate-400">
                Last checked: {new Date(lastSyncTime).toLocaleTimeString()} (
                {formatDate(lastSyncTime)})
              </div>
            </div>
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Simulating Plaid Sync...' : 'Simulate Feed Sync Now'}</span>
            </button>
          </div>

          {!latestDiff ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-2">
              <Sparkles className="w-8 h-8 text-violet-400 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-200">
                Baseline Feeds Synchronized
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Click <strong>"Simulate Feed Sync Now"</strong> above to simulate incoming live transactions from Plaid and watch unsettled charges post in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    New Transactions Ingested
                  </span>
                  <div className="text-xl font-bold text-violet-400 mt-1">
                    +{latestDiff.newTransactions.length}
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Settled from Pending
                  </span>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {latestDiff.pendingToPosted.length} charges
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    New Anomalies Surfaced
                  </span>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {latestDiff.newAnomalies.length}
                  </div>
                </div>
              </div>

              {/* 1. New Transactions Stream */}
              {latestDiff.newTransactions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <span>New Transactions Ingested Since Last Sync</span>
                  </h4>
                  <div className="space-y-2">
                    {latestDiff.newTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 rounded-lg bg-slate-950/60 border border-violet-500/30 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-2">
                            <span>{tx.cleanMerchant}</span>
                            <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1 rounded">
                              NEW
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {tx.rawDescription} • {tx.accountName}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="font-mono font-bold text-slate-200 text-sm">
                            {formatCurrency(tx.amount)}
                          </span>
                          <button
                            onClick={() => onOpenAudit(tx.id)}
                            className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 cursor-pointer"
                          >
                            Why?
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Charges Settled from Pending to Posted */}
              {latestDiff.pendingToPosted.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Charges Settled (Pending -&gt; Posted)</span>
                  </h4>
                  <div className="space-y-2">
                    {latestDiff.pendingToPosted.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 rounded-lg bg-slate-950/60 border border-emerald-500/30 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-100">
                            {tx.cleanMerchant}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Pre-authorization hold has finalized into cleared ledger balance.
                          </div>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Account Balance Deltas */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Account Balance Shifts</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {latestDiff.balanceDeltas.map((bd) => (
                    <div
                      key={bd.accountId}
                      className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{bd.accountName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Current: {formatCurrency(bd.currentBalance)}
                        </div>
                      </div>
                      <div className="text-right">
                        {bd.delta !== 0 ? (
                          <span
                            className={`font-mono font-bold ${
                              bd.delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {bd.delta > 0 ? '+' : ''}
                            {formatCurrency(bd.delta)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">No change</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
