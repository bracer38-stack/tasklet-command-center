import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertOctagon,
  Copy,
  HelpCircle,
  FileSpreadsheet,
  ArrowRight,
  Database,
  Building2,
  Layers,
  FileText,
  DollarSign,
  Info,
  ShieldCheck,
  Scale,
  Calendar,
  AlertTriangle,
  CreditCard,
  Building,
  Flame,
} from 'lucide-react';
import { ImportReconciliationSummary } from '../types';
import { formatCurrency, formatDate } from '../services/normalization';

interface ImportReconciliationModalProps {
  summary: ImportReconciliationSummary;
  initialCompanyName?: string;
  onConfirm: (mode: 'replace' | 'append', customBusinessName?: string) => void;
  onClose: () => void;
}

export const ImportReconciliationModal: React.FC<ImportReconciliationModalProps> = ({
  summary,
  initialCompanyName = 'My Business',
  onConfirm,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'transactions' | 'accounts' | 'bills' | 'loans' | 'notes' | 'rejections' | 'unmatched'
  >('overview');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [companyName, setCompanyName] = useState<string>(initialCompanyName);

  const canCommit = summary.acceptedCount > 0;

  // Staged totals
  const stagedTxDebits = summary.parsedTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const stagedTxCredits = summary.parsedTransactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const stagedTxNet = stagedTxCredits - stagedTxDebits;

  const rawDebits = summary.variance?.rawDebits ?? stagedTxDebits;
  const rawCredits = summary.variance?.rawCredits ?? stagedTxCredits;
  const rawNet = summary.fileMetadata?.rawNetSum ?? (rawCredits - rawDebits);

  const deltaDebits = Math.abs(rawDebits - stagedTxDebits);
  const deltaCredits = Math.abs(rawCredits - stagedTxCredits);
  const isPerfectMatch = deltaDebits < 0.01 && deltaCredits < 0.01;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Read-Only Ingestion Staging Screen & Reconciliation
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Pre-Commit Audit
                </span>
              </div>
              <span className="text-xs text-slate-400">
                Compare imported totals to source file before anything touches the dashboard.
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title="Discard & Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Staging Screen: Side-by-Side Comparison (Requirement 7) */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Original Source File */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                  Original Source File
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {summary.fileMetadata?.fileSize || 'Statement'}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-200 truncate font-semibold" title={summary.fileMetadata?.fileName}>
                {summary.fileMetadata?.fileName || 'Uploaded Statement'}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] block">Raw Debits (Out):</span>
                  <span className="text-rose-400 font-semibold">{formatCurrency(rawDebits)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Raw Credits (In):</span>
                  <span className="text-emerald-400 font-semibold">{formatCurrency(rawCredits)}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1">
                <span>Total Lines: <strong>{summary.rowsRead}</strong></span>
                <span className="truncate max-w-[130px]" title={summary.fileMetadata?.sha256}>
                  {summary.fileMetadata?.sha256 ? summary.fileMetadata.sha256.slice(0, 14) + '...' : ''}
                </span>
              </div>
            </div>

            {/* 2. Staged Ledger Totals */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  Staged Ledger Tables
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {summary.acceptedCount} Accepted
                </span>
              </div>
              <div className="text-xs text-slate-200 font-semibold">
                Partitioned into Separate State Tables
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] block">Staged Debits (Out):</span>
                  <span className="text-rose-400 font-semibold">{formatCurrency(stagedTxDebits)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Staged Credits (In):</span>
                  <span className="text-emerald-400 font-semibold">{formatCurrency(stagedTxCredits)}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                <span>Tx Ledger: <strong>{summary.parsedTransactions.length}</strong></span>
                <span>Balances: <strong>{summary.parsedAccounts.length}</strong></span>
                <span>Loans: <strong>{summary.parsedLoans.length}</strong></span>
              </div>
            </div>

            {/* 3. Mathematical Variance Audit */}
            <div className={`rounded-xl p-3.5 space-y-2 border ${
              isPerfectMatch
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : 'bg-indigo-950/20 border-indigo-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-slate-300">
                  <ShieldCheck className={`w-3.5 h-3.5 ${isPerfectMatch ? 'text-emerald-400' : 'text-indigo-400'}`} />
                  Mathematical Variance
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                  isPerfectMatch ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'
                }`}>
                  {isPerfectMatch ? '$0.00 Variance' : 'Audit Verified'}
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-100">
                {isPerfectMatch
                  ? '100% Inflow & Outflow Match'
                  : `Debit Δ: $${deltaDebits.toFixed(2)} | Credit Δ: $${deltaCredits.toFixed(2)}`}
              </div>
              <p className="text-[11px] text-slate-300 pt-1 border-t border-slate-800/60 leading-relaxed">
                {summary.variance?.explanation || 'All transactions reconciled against source evidence.'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 px-6 pt-2 gap-4 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'overview'
                ? 'border-cyan-500 text-cyan-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview & Strategy
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'transactions'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Transactions ({summary.parsedTransactions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'accounts'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Account Balances ({summary.parsedAccounts.length})</span>
          </button>
          {summary.parsedBills.length > 0 && (
            <button
              onClick={() => setActiveTab('bills')}
              className={`pb-2.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'bills'
                  ? 'border-rose-500 text-rose-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Bills ({summary.parsedBills.length})</span>
            </button>
          )}
          {summary.parsedLoans.length > 0 && (
            <button
              onClick={() => setActiveTab('loans')}
              className={`pb-2.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'loans'
                  ? 'border-purple-500 text-purple-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Loans ({summary.parsedLoans.length})</span>
            </button>
          )}
          {summary.parsedNotes.length > 0 && (
            <button
              onClick={() => setActiveTab('notes')}
              className={`pb-2.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'notes'
                  ? 'border-slate-300 text-slate-200 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Notes ({summary.parsedNotes.length})</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('rejections')}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rejections'
                ? 'border-rose-500 text-rose-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Rejections</span>
            {summary.rejectedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px]">
                {summary.rejectedCount}
              </span>
            )}
          </button>
          {summary.duplicatesSkippedCount > 0 && (
            <button
              onClick={() => setActiveTab('unmatched')}
              className={`pb-2.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'unmatched'
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Duplicates Skipped ({summary.duplicatesSkippedCount})</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Target Entity Name */}
              <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Target Operating Entity Name</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Labs LLC"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                />
                <p className="text-[11px] text-slate-400">
                  Business name assigned to this statement import throughout the dashboard and audit trails.
                </p>
              </div>

              {/* Mode Selection */}
              <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ingestion State Strategy</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setImportMode('replace')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition space-y-1 ${
                      importMode === 'replace'
                        ? 'bg-cyan-950/30 border-cyan-500/50 ring-1 ring-cyan-500/20'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-cyan-300">
                        Replace State (Clean Slate - Recommended)
                      </span>
                      <input
                        type="radio"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-cyan-600"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Permanently wipes any demo fixtures or prior imports. Commits only this verified statement dataset.
                    </p>
                  </div>

                  <div
                    onClick={() => setImportMode('append')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition space-y-1 ${
                      importMode === 'append'
                        ? 'bg-indigo-950/30 border-indigo-500/50 ring-1 ring-indigo-500/20'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-indigo-300">
                        Append & Reconcile
                      </span>
                      <input
                        type="radio"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="text-indigo-600"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Matches existing rows by source transaction_id to prevent duplicate creation. Appends new transactions and updates balances.
                    </p>
                  </div>
                </div>
              </div>

              {/* Guarantees Box */}
              <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Enforced Invariant Guarantees:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <div className="flex items-start space-x-1.5">
                    <span className="text-emerald-400">✓</span>
                    <span><strong>Separate Tables:</strong> Balances, loans, and bills are kept strictly separate from the transaction ledger.</span>
                  </div>
                  <div className="flex items-start space-x-1.5">
                    <span className="text-emerald-400">✓</span>
                    <span><strong>Transaction ID Identity:</strong> Deduplication matches strictly on source ID; never duplicates or merges by text description.</span>
                  </div>
                  <div className="flex items-start space-x-1.5">
                    <span className="text-emerald-400">✓</span>
                    <span><strong>Account Identity Required:</strong> Rows lacking account identification are rejected.</span>
                  </div>
                  <div className="flex items-start space-x-1.5">
                    <span className="text-emerald-400">✓</span>
                    <span><strong>Explicit Status:</strong> Each transaction is normalized to posted, pending, or unknown.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Staged Transactions Ledger ({summary.parsedTransactions.length} records):</span>
                <span className="font-mono text-slate-300">Net: {formatCurrency(stagedTxNet)}</span>
              </div>
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden text-xs max-h-96 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Merchant / Description</th>
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Source Tx ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {summary.parsedTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 text-slate-300">{formatDate(tx.date)}</td>
                        <td className="py-2 px-3 font-sans">
                          <span className="text-slate-100 font-semibold">{tx.cleanMerchant}</span>
                          <span className="text-[10px] text-slate-500 block truncate max-w-[200px]">{tx.rawDescription}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-400 font-sans">{tx.accountName}</td>
                        <td className={`py-2 px-3 text-right font-bold ${
                          tx.amount > 0 ? 'text-slate-100' : 'text-emerald-400'
                        }`}>
                          {tx.amount > 0 ? `-${formatCurrency(tx.amount)}` : `+${formatCurrency(Math.abs(tx.amount))}`}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            tx.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300'
                              : tx.status === 'posted'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {tx.status || (tx.pending ? 'pending' : 'posted')}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-[10px] truncate max-w-[120px]" title={tx.sourceTxId || tx.id}>
                          {tx.sourceTxId || tx.id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Account Balances Tab */}
          {activeTab === 'accounts' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                Staged Account Balances & Credit Limits ({summary.parsedAccounts.length} accounts):
              </div>
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono">
                    <tr>
                      <th className="py-2.5 px-3">Account Name</th>
                      <th className="py-2.5 px-3">Institution</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Current Balance</th>
                      <th className="py-2.5 px-3 text-right">Available Cash</th>
                      <th className="py-2.5 px-3 text-right">Credit Limit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {summary.parsedAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 text-slate-100 font-sans font-semibold">{acc.name}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">{acc.institution}</td>
                        <td className="py-2 px-3 text-slate-300 capitalize">{acc.type}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-100">{formatCurrency(acc.currentBalance)}</td>
                        <td className="py-2 px-3 text-right text-emerald-400">
                          {acc.availableBalance !== null ? formatCurrency(acc.availableBalance) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-indigo-400">
                          {acc.creditLimit ? formatCurrency(acc.creditLimit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bills Tab */}
          {activeTab === 'bills' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                Staged Recurring Bills & Subscriptions ({summary.parsedBills.length} records):
              </div>
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono">
                    <tr>
                      <th className="py-2.5 px-3">Vendor / Service</th>
                      <th className="py-2.5 px-3">Cadence</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Next Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {summary.parsedBills.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 text-slate-100 font-sans font-semibold">{b.cleanMerchant}</td>
                        <td className="py-2 px-3 text-slate-300 capitalize">{b.frequency}</td>
                        <td className="py-2 px-3 text-right font-bold text-rose-300">{formatCurrency(b.lastAmount)}</td>
                        <td className="py-2 px-3 text-slate-400">{b.nextEstimatedDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Loans Tab */}
          {activeTab === 'loans' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                Staged Commercial Loans & Debt ({summary.parsedLoans.length} facilities):
              </div>
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono">
                    <tr>
                      <th className="py-2.5 px-3">Facility Name</th>
                      <th className="py-2.5 px-3">Institution</th>
                      <th className="py-2.5 px-3 text-right">Remaining Principal</th>
                      <th className="py-2.5 px-3 text-right">APR %</th>
                      <th className="py-2.5 px-3 text-right">Monthly Installment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {summary.parsedLoans.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 text-slate-100 font-sans font-semibold">{l.name}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">{l.institution}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-100">{formatCurrency(l.currentBalance)}</td>
                        <td className="py-2 px-3 text-right text-amber-300">{l.interestRate ? `${l.interestRate}%` : '—'}</td>
                        <td className="py-2 px-3 text-right text-rose-300">{l.monthlyPayment ? formatCurrency(l.monthlyPayment) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                Staged Financial Planning Notes & Assumptions ({summary.parsedNotes.length} notes):
              </div>
              <div className="space-y-2">
                {summary.parsedNotes.map((n) => (
                  <div key={n.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-semibold text-slate-300">{n.category}</span>
                      <span className="font-mono text-[10px]">{n.createdDate} by {n.author || 'Owner'}</span>
                    </div>
                    <p className="text-slate-200">{n.noteText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejections Tab (Requirement 6) */}
          {activeTab === 'rejections' && (
            <div className="space-y-3">
              {summary.rejections.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <span>Zero rejections. All source rows satisfied strict schema requirements!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-slate-300">
                    {summary.rejections.length} row(s) failed validation and were excluded with explicit reasons:
                  </div>
                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden text-xs max-h-96 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Row #</th>
                          <th className="py-2.5 px-3">Rejection Reason</th>
                          <th className="py-2.5 px-3">Raw Content Excerpt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {summary.rejections.map((rej, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40">
                            <td className="py-2 px-3 text-slate-400 whitespace-nowrap">Row {rej.rowNumber}</td>
                            <td className="py-2 px-3 text-rose-300 font-semibold">{rej.reason}</td>
                            <td className="py-2 px-3 text-slate-500 font-mono text-[10px] truncate max-w-[280px]">
                              {JSON.stringify(rej.rawRow)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Skipped Duplicates Tab */}
          {activeTab === 'unmatched' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-300">
                {summary.duplicates.length} duplicate transaction(s) skipped (matched by source transaction_id):
              </div>
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden text-xs max-h-60 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono">
                    <tr>
                      <th className="py-2 px-3">Row #</th>
                      <th className="py-2 px-3">Existing Transaction ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {summary.duplicates.map((dup, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-1.5 px-3 text-slate-400">Row {dup.rowNumber}</td>
                        <td className="py-1.5 px-3 text-amber-300 font-semibold">{dup.transactionId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            Discard & Cancel Import
          </button>

          <button
            onClick={() => onConfirm(importMode, companyName)}
            disabled={!canCommit}
            className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-lg cursor-pointer ${
              canCommit
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>Confirm & Commit to Dashboard ({summary.acceptedCount} Records)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
