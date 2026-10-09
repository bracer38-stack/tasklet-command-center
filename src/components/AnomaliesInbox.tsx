import React, { useState } from 'react';
import {
  AlertTriangle,
  Copy,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Tag,
  ArrowRight,
  Zap,
  Trash2,
  Sparkles,
  Filter,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatDate } from '../services/normalization';
import { TransactionClassification } from '../types';

interface AnomaliesInboxProps {
  onOpenAudit: (txId: string) => void;
}

export const AnomaliesInbox: React.FC<AnomaliesInboxProps> = ({ onOpenAudit }) => {
  const {
    transactions,
    handleReclassify,
    handleResolveAnomaly,
    handleDeleteTransaction,
    handlePurgeDemoArtifacts,
  } = useFinancial();

  const [filterMode, setFilterMode] = useState<'all' | 'anomalies_only' | 'review_only'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Filter transactions
  const flaggedTransactions = transactions.filter((t) => {
    const hasAnom = t.anomalies.length > 0;
    const needsReview = t.classification === 'needs_review';
    if (filterMode === 'anomalies_only') return hasAnom;
    if (filterMode === 'review_only') return needsReview;
    return hasAnom || needsReview;
  });

  const unreviewedCount = transactions.filter((t) => t.classification === 'needs_review').length;
  const anomalyCount = transactions.filter((t) => t.anomalies.length > 0).length;

  const hasDemoArtifacts = transactions.some((t) => {
    const d = `${t.rawDescription} ${t.merchantName} ${t.cleanMerchant}`.toLowerCase();
    return d.includes('gary danko') || d.includes('vercel');
  });

  const totalPages = Math.max(1, Math.ceil(flaggedTransactions.length / pageSize));
  const paginatedItems = flaggedTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Anomalies & Classification Triage Inbox
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated heuristics flag duplicate swiping, unexpected vendor charges, unusual spikes, and items requiring classification.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
              {anomalyCount} Flagged Anomalies
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              {unreviewedCount} Unreviewed
            </span>
          </div>
        </div>

        {/* Demo Artifact Alert */}
        {hasDemoArtifacts && (
          <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Demo artifacts detected:</strong> Sample records (Gary Danko dining, Vercel deploy) from the initial template are in your ledger.
              </span>
            </div>
            <button
              onClick={handlePurgeDemoArtifacts}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg shadow-sm transition cursor-pointer flex items-center space-x-1 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Demo Artifacts</span>
            </button>
          </div>
        )}

        {/* Review-First Invariant Banner */}
        {unreviewedCount > 0 && (
          <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-indigo-200">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                <strong>{unreviewedCount} transactions require review:</strong> To prevent skewed P&L, silent tax misclassifications, and blended personal draws, items remain in <em>Needs Review</em> until explicitly confirmed with an audit reason.
              </span>
            </div>
            <div className="text-[11px] text-indigo-300/80 font-mono shrink-0">
              Zero-Guessing Default Active
            </div>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex items-center space-x-2 pt-2 border-t border-slate-800 text-xs">
          <span className="text-slate-400">View:</span>
          <button
            onClick={() => { setFilterMode('all'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All Items ({anomalyCount + unreviewedCount})
          </button>
          <button
            onClick={() => { setFilterMode('anomalies_only'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
              filterMode === 'anomalies_only'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Flagged Anomalies ({anomalyCount})
          </button>
          <button
            onClick={() => { setFilterMode('review_only'); setCurrentPage(1); }}
            className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
              filterMode === 'review_only'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Unreviewed Only ({unreviewedCount})
          </button>
        </div>
      </div>

      {/* Flagged Items Cards Grid */}
      {flaggedTransactions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-200">Inbox Zero: All Clean!</h3>
          <p className="text-xs text-slate-400 mt-1">
            No duplicate charges, classification conflicts, or unreviewed items found.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedItems.map((tx) => {
            const hasClassAnomaly = tx.anomalies.some((a) => a.type === 'classification_anomaly');

            return (
              <div
                key={tx.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 shadow-sm transition space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-100">{tx.cleanMerchant || tx.merchantName}</span>
                      <span className="text-xs text-slate-400 font-mono">({tx.accountName})</span>
                      <span className="text-[10px] text-slate-400">{formatDate(tx.date)}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{tx.rawDescription}</div>
                  </div>

                  <div className="flex items-center space-x-3 self-start sm:self-auto">
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-100 text-sm">
                        {formatCurrency(Math.abs(tx.amount))}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Status: <strong className="uppercase text-indigo-400">{tx.classification.replace('_', ' ')}</strong>
                      </span>
                    </div>

                    <button
                      onClick={() => onOpenAudit(tx.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition cursor-pointer"
                    >
                      Audit Trail
                    </button>

                    <button
                      onClick={() => handleDeleteTransaction(tx.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900 transition cursor-pointer"
                      title="Delete transaction from ledger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Anomaly Alerts List */}
                {tx.anomalies.length > 0 && (
                  <div className="space-y-2">
                    {tx.anomalies.map((anom) => (
                      <div
                        key={anom.id}
                        className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                          anom.severity === 'high'
                            ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                            : 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{anom.message}</span>
                          </div>
                          {anom.details && (
                            <p className="text-[11px] text-slate-300">{anom.details}</p>
                          )}
                        </div>

                        <button
                          onClick={() => handleResolveAnomaly(tx.id, anom.id)}
                          className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition shrink-0 cursor-pointer"
                        >
                          Dismiss / Verified
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick 1-Click Resolution Actions */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Quick Reclassify:</span>

                  {hasClassAnomaly && (
                    <button
                      onClick={() =>
                        handleReclassify(
                          tx.id,
                          'personal',
                          'Triage Inbox: reclassified personal expense on business account to Personal Draw'
                        )
                      }
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/40 transition cursor-pointer"
                    >
                      Classify as Personal Draw
                    </button>
                  )}

                  <button
                    onClick={() =>
                      handleReclassify(
                        tx.id,
                        'business',
                        'Triage Inbox: confirmed as verified business operating expense'
                      )
                    }
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 border border-blue-500/40 transition cursor-pointer"
                  >
                    Confirm Business Expense
                  </button>

                  <button
                    onClick={() =>
                      handleReclassify(
                        tx.id,
                        'reimbursement',
                        'Triage Inbox: flagged as corporate employee/owner reimbursement'
                      )
                    }
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 transition cursor-pointer"
                  >
                    Mark Reimbursement
                  </button>

                  <button
                    onClick={() =>
                      handleReclassify(
                        tx.id,
                        'transfer',
                        'Triage Inbox: designated as internal transfer'
                      )
                    }
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 border border-cyan-500/40 transition cursor-pointer"
                  >
                    Mark Transfer
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs">
              <span className="text-slate-400">
                Page {currentPage} of {totalPages} ({flaggedTransactions.length} items)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
