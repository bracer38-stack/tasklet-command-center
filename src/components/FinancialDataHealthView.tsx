import React from 'react';
import {
  Activity,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Building2,
  HelpCircle,
  Zap,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatDate } from '../services/normalization';

interface FinancialDataHealthViewProps {
  onOpenMetricAudit?: (metricKey: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const FinancialDataHealthView: React.FC<FinancialDataHealthViewProps> = ({
  onOpenMetricAudit,
  onNavigateTab,
}) => {
  const {
    dataHealth,
    transactions,
    handleResolveStaleAccount,
    handleBulkClassify,
    handlePurgeDemoArtifacts,
  } = useFinancial();

  const isHealthy = dataHealth.status === 'healthy';
  const isWarning = dataHealth.status === 'warning';
  const isCritical = dataHealth.status === 'critical' || dataHealth.status === 'degraded';

  const unreviewedCount = transactions.filter((t) => t.classification === 'needs_review').length;
  const hasDemoArtifacts = transactions.some((t) => {
    const d = `${t.rawDescription} ${t.merchantName} ${t.cleanMerchant}`.toLowerCase();
    return d.includes('gary danko') || d.includes('vercel');
  });

  return (
    <div className="space-y-6">
      {/* Demo Artifact Alert */}
      {hasDemoArtifacts && (
        <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Demo artifact detected:</strong> Sample records (Gary Danko dining, Vercel deploy) from the initial template are present in the ledger.
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

      {/* Unreviewed Transactions Notice Banner */}
      {unreviewedCount > 0 && (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 text-xs text-indigo-200">
            <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <div className="font-semibold text-slate-100 text-sm">
                Ledger Quality Notice: {unreviewedCount} Transactions In Needs Review
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Zero-guessing policy: Imported records remain in Needs Review until owner classification is recorded. Review them with audit trail reasoning.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition flex items-center space-x-1.5 shrink-0 cursor-pointer"
          >
            <span>Review in Transactions Hub &rarr;</span>
          </button>
        </div>
      )}

      {/* 1. Header & System Confidence Score */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Financial Data Health & Integrity Monitor
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous audit of source institution feeds, balance freshness, transaction coverage, and ledger reconciliation confidence.
            </p>
          </div>

          {/* Confidence Score Pill */}
          <div className="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl border border-slate-800 self-start md:self-auto">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Ledger Confidence
              </span>
              <div
                className={`text-2xl font-bold font-mono tracking-tight ${
                  isCritical
                    ? 'text-rose-400'
                    : isWarning
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {dataHealth.overallConfidenceScore}%
              </div>
            </div>

            <div
              className={`p-2.5 rounded-xl border ${
                isCritical
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : isWarning
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isHealthy ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
          </div>
        </div>

        {/* Confidence Penalties / Factors Breakdown */}
        {dataHealth.confidenceFactors.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-300">
              Confidence Score Factors ({dataHealth.confidenceFactors.length}):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {dataHealth.confidenceFactors.map((factor, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-slate-200">{factor.factor}</div>
                    <div className="text-[10px] text-slate-400">{factor.reason}</div>
                  </div>
                  <span className="font-mono font-bold text-rose-400 text-xs shrink-0 ml-2">
                    {factor.scoreDelta} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Institution Connections & Coverage Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm space-y-2">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Financial Institutions & Source Feeds
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sync status, source balance timestamps, and transaction coverage range per provider.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {dataHealth.institutions.length} Institutions Connected
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Institution</th>
                <th className="py-3 px-4">Accounts</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Sync Timestamp</th>
                <th className="py-3 px-4">Source Balance Timestamp</th>
                <th className="py-3 px-4">Transaction Coverage</th>
                <th className="py-3 px-4 text-right">Feed Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {dataHealth.institutions.map((inst) => {
                const hasError = inst.status === 'sync_error';
                const isStale = inst.status === 'stale';
                const isPartial = inst.status === 'partial';

                return (
                  <tr key={inst.name} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100 text-sm">{inst.name}</div>
                      {inst.errorDetails && (
                        <div className="text-[10px] text-rose-400 font-medium mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{inst.errorDetails}</span>
                        </div>
                      )}
                      {/* 5-Dimension Verification Breakdown */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {inst.dimensions?.map((dim) => (
                          <span
                            key={dim.name}
                            className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${
                              dim.status === 'healthy'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                : dim.status === 'partial'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold'
                                : dim.status === 'error' || dim.status === 'stale'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-semibold'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                            title={`${dim.dimension}: ${dim.detail}`}
                          >
                            {dim.dimension}: {dim.status.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {inst.accountCount} account(s)
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          hasError
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : isStale
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : isPartial
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {isPartial ? 'Partial / Sparse Feed' : inst.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-mono">
                      {new Date(inst.lastSyncTimestamp).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {inst.sourceBalanceTimestamp
                        ? new Date(inst.sourceBalanceTimestamp).toLocaleTimeString()
                        : 'Unavailable (CSV statement)'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-mono">
                      <div>
                        {inst.transactionCoverage.earliestDate} &rarr; {inst.transactionCoverage.latestDate}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        ({inst.transactionCoverage.count} transactions)
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {hasError || isStale ? (
                        <button
                          onClick={() => onNavigateTab('cards-loans')}
                          className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer"
                        >
                          Re-auth Feed
                        </button>
                      ) : isPartial ? (
                        <span className="text-[11px] text-amber-400 flex items-center gap-1 justify-end font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          Partial / Verify
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1 justify-end font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Healthy (5/5 Passed)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Unresolved Reconciliation Issues Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Unresolved Reconciliation Issues ({dataHealth.unresolvedIssues.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Items that degrade system confidence. All items can be resolved below to achieve certified confidence.
            </p>
          </div>
        </div>

        {dataHealth.unresolvedIssues.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/80">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-200">Zero Unresolved Reconciliation Issues</h4>
            <p className="text-xs text-slate-400 mt-0.5">All feeds are synchronized and ledger classifications verified.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dataHealth.unresolvedIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center space-x-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      issue.severity === 'high'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : issue.severity === 'medium'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {issue.severity}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-200">{issue.description}</span>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Category: {issue.category.replace('_', ' ')} • Entity ID: {issue.affectedEntityId}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => {
                      if (issue.category === 'unreviewed_tx') {
                        onNavigateTab('transactions');
                      } else if (issue.category === 'possible_duplicate') {
                        onNavigateTab('anomalies');
                      } else {
                        onNavigateTab('cards-loans');
                      }
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition cursor-pointer shrink-0"
                  >
                    Resolve Issue &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
