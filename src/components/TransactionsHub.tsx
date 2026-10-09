import React, { useState } from 'react';
import {
  Search,
  Filter,
  AlertTriangle,
  ArrowRightLeft,
  CreditCard,
  CheckCircle,
  HelpCircle,
  SlidersHorizontal,
  Trash2,
  CheckSquare,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  X,
  Save,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency } from '../services/normalization';
import { TransactionClassification } from '../types';

interface TransactionsHubProps {
  onOpenAudit: (txId: string) => void;
}

const CLASSIFICATION_OPTIONS: { value: TransactionClassification; label: string }[] = [
  { value: 'business', label: 'Business Expense' },
  { value: 'personal', label: 'Personal Draw' },
  { value: 'transfer', label: 'Internal Transfer' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'income', label: 'Business Income' },
  { value: 'debt_payment', label: 'Debt Payment' },
  { value: 'needs_review', label: 'Needs Review' },
];

export const TransactionsHub: React.FC<TransactionsHubProps> = ({ onOpenAudit }) => {
  const {
    transactions,
    accounts,
    filters,
    setFilters,
    handleReclassify,
    handleClassifySelected,
    handleRevertClassification,
    handleDeleteTransaction,
    handlePurgeDemoArtifacts,
    handleBulkClassify,
  } = useFinancial();

  const [pageSize, setPageSize] = useState<number | 'all'>(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false);
  const [bulkTargetClass, setBulkTargetClass] = useState<TransactionClassification>('business');
  const [bulkReason, setBulkReason] = useState('');
  const [isBatchPersonalConfirmOpen, setIsBatchPersonalConfirmOpen] = useState(false);
  const [batchPersonalReason, setBatchPersonalReason] = useState('Owner verification: Remaining non-business transactions confirmed as personal');

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    // Search query
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchMerchant = tx.cleanMerchant.toLowerCase().includes(q);
      const matchRaw = tx.rawDescription.toLowerCase().includes(q);
      const matchCat = tx.category.some((c) => c.toLowerCase().includes(q));
      const matchAmount = tx.amount.toString().includes(q);
      if (!matchMerchant && !matchRaw && !matchCat && !matchAmount) return false;
    }

    // Status (Posted vs Pending)
    if (filters.status === 'posted' && tx.pending) return false;
    if (filters.status === 'pending' && !tx.pending) return false;

    // Classification
    if (filters.classification !== 'all' && tx.classification !== filters.classification) {
      return false;
    }

    // Account
    if (filters.accountId !== 'all' && tx.accountId !== filters.accountId) {
      return false;
    }

    // Entity filter
    if (filters.entity && filters.entity !== 'all') {
      const isPersonal = tx.entity === 'personal' || tx.accountName.toLowerCase().includes('personal');
      if (filters.entity === 'business' && isPersonal) return false;
      if (filters.entity === 'personal' && !isPersonal) return false;
    }

    // Anomalies Only
    if (filters.hasAnomalyOnly && tx.anomalies.length === 0) {
      return false;
    }

    return true;
  });

  const unreviewedCount = transactions.filter((t) => t.classification === 'needs_review').length;

  const hasDemoArtifacts = transactions.some((t) => {
    const d = `${t.rawDescription} ${t.merchantName} ${t.cleanMerchant}`.toLowerCase();
    return d.includes('gary danko') || d.includes('vercel');
  });

  // Pagination calculation
  const totalItems = filteredTransactions.length;
  const currentLimit = pageSize === 'all' ? totalItems : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / (pageSize === 'all' ? totalItems || 1 : pageSize)));
  const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
  const paginatedTransactions = filteredTransactions.slice(
    startIndex,
    startIndex + currentLimit
  );

  const handleApplyBulkClassification = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTxIds.size === 0) return;
    const reasonText =
      bulkReason.trim() ||
      `Owner manual verification for ${selectedTxIds.size} selected transactions`;
    handleClassifySelected(Array.from(selectedTxIds), bulkTargetClass, reasonText);
    setSelectedTxIds(new Set());
    setIsClassifyModalOpen(false);
    setBulkReason('');
  };

  return (
    <div className="space-y-4">
      {/* Demo Artifacts Alert Banner (if Gary Danko or Vercel are present) */}
      {hasDemoArtifacts && (
        <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Demo artifact detected:</strong> Sample records (such as Gary Danko dining or Vercel deploy) from the initial template are still in your ledger.
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

      {/* Unreviewed Transactions Notice Banner - Review First Guard */}
      {unreviewedCount > 0 ? (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-indigo-200">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong>{unreviewedCount} unreviewed transactions:</strong> Quarantined in <em>Needs Review</em> by default (strict zero-guessing policy). You can review rows individually, or batch-mark remaining items as Personal Draw.
            </span>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => {
                setFilters((f) => ({ ...f, classification: 'needs_review' }));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg font-medium cursor-pointer"
            >
              Filter to Needs Review ({unreviewedCount})
            </button>
            <button
              onClick={() => {
                setBatchPersonalReason('Owner verification: Remaining non-business transactions confirmed as personal');
                setIsBatchPersonalConfirmOpen(true);
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg shadow-sm transition cursor-pointer flex items-center space-x-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Mark Rest as Personal ({unreviewedCount})</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-emerald-300">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>All transactions categorized & verified:</strong> 0 unreviewed items. Business P&L and personal distributions are completely partitioned.
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Zero Unreviewed Queue
          </span>
        </div>
      )}

      {/* Explicit Row Selection Action Bar */}
      {selectedTxIds.size > 0 && (
        <div className="bg-indigo-950/80 border border-indigo-500/60 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center space-x-2 text-indigo-200">
            <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong>{selectedTxIds.size} transactions selected</strong> for explicit classification.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setBulkReason('');
                setIsClassifyModalOpen(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-sm transition cursor-pointer"
            >
              Classify Selected ({selectedTxIds.size})
            </button>
            <button
              onClick={() => setSelectedTxIds(new Set())}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Top Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search merchants, descriptions, categories, amounts..."
              value={filters.search}
              onChange={(e) => {
                setFilters((f) => ({ ...f, search: e.target.value }));
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Status Pills: All / Posted / Pending */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {(['all', 'posted', 'pending'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setFilters((f) => ({ ...f, status: s }));
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md capitalize font-medium transition cursor-pointer ${
                  filters.status === s
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-xs">
          {/* Classification Filter */}
          <div className="flex items-center space-x-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Class:</span>
            <select
              value={filters.classification}
              onChange={(e) => {
                setFilters((f) => ({
                  ...f,
                  classification: e.target.value as any,
                }));
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Classifications</option>
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Account Filter */}
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Account:</span>
            <select
              value={filters.accountId}
              onChange={(e) => {
                setFilters((f) => ({ ...f, accountId: e.target.value }));
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.institution})
                </option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Entity:</span>
            <select
              value={filters.entity || 'all'}
              onChange={(e) => {
                setFilters((f) => ({ ...f, entity: e.target.value as any }));
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Entities</option>
              <option value="business">Business Only</option>
              <option value="personal">Personal / Household</option>
            </select>
          </div>

          {/* Anomaly Toggle */}
          <label className="flex items-center space-x-2 text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.hasAnomalyOnly}
              onChange={(e) => {
                setFilters((f) => ({ ...f, hasAnomalyOnly: e.target.checked }));
                setCurrentPage(1);
              }}
              className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Flagged Anomalies</span>
            </span>
          </label>

          {/* Items per page selector */}
          <div className="flex items-center space-x-1.5 ml-auto">
            <span className="text-slate-400 text-[11px]">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-300 cursor-pointer"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value="all">All ({totalItems})</option>
            </select>
          </div>

          {/* Count Badge */}
          <span className="text-slate-400 font-mono text-[11px]">
            Showing {paginatedTransactions.length} of {filteredTransactions.length}
          </span>
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3 w-[40px] text-center">
                  <input
                    type="checkbox"
                    checked={
                      paginatedTransactions.length > 0 &&
                      paginatedTransactions.every((t) => selectedTxIds.has(t.id))
                    }
                    onChange={(e) => {
                      const next = new Set(selectedTxIds);
                      if (e.target.checked) {
                        paginatedTransactions.forEach((t) => next.add(t.id));
                      } else {
                        paginatedTransactions.forEach((t) => next.delete(t.id));
                      }
                      setSelectedTxIds(next);
                    }}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    title="Select all visible transactions"
                  />
                </th>
                <th className="py-3 px-3 w-[110px]">Date / Status</th>
                <th className="py-3 px-3">Merchant / Description</th>
                <th className="py-3 px-3 w-[130px] text-right font-semibold text-slate-300">Amount</th>
                <th className="py-3 px-3 w-[160px]">Account</th>
                <th className="py-3 px-3 w-[180px]">Classification</th>
                <th className="py-3 px-3 w-[120px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    {transactions.length === 0
                      ? 'No transactions in ledger. Upload a bank statement or Plaid CSV export to start tracking.'
                      : 'No transactions match the selected filters.'}
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const amountNum = typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0;
                  const isInflow = amountNum < 0;
                  const hasAnomalies = tx.anomalies.length > 0;
                  const isOverridden = tx.auditTrail.some((a) => a.userOverridden);
                  const canRevert = tx.auditTrail.some(
                    (a) => a.canRevert || (a.userOverridden && a.priorClassification)
                  );
                  const isPersonal = tx.entity === 'personal' || tx.accountName.toLowerCase().includes('personal');

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-800/40 transition group ${
                        selectedTxIds.has(tx.id) ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center align-top">
                        <input
                          type="checkbox"
                          checked={selectedTxIds.has(tx.id)}
                          onChange={() => {
                            const next = new Set(selectedTxIds);
                            if (next.has(tx.id)) next.delete(tx.id);
                            else next.add(tx.id);
                            setSelectedTxIds(next);
                          }}
                          className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer mt-0.5"
                        />
                      </td>

                      {/* 1. Date & Pending Badge */}
                      <td className="py-3 px-3 whitespace-nowrap align-top">
                        <div className="font-mono text-slate-300 font-medium">{tx.date}</div>
                        {tx.pending ? (
                          <span className="inline-block mt-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 rounded uppercase tracking-wider">
                            Pending Hold
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] text-slate-500">
                            <CheckCircle className="w-2.5 h-2.5 text-emerald-500/70" />
                            Posted
                          </span>
                        )}
                      </td>

                      {/* 2. Merchant & Raw Description */}
                      <td className="py-3 px-3 align-top">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5 flex-wrap">
                          <span>{tx.cleanMerchant || tx.merchantName || 'Unknown Merchant'}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded border font-medium ${
                              isPersonal
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                            }`}
                          >
                            {isPersonal ? 'Personal' : 'Business'}
                          </span>
                          {tx.isTransferCounterpart && (
                            <span
                              className="text-[9px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1 rounded flex items-center gap-0.5"
                              title="Linked transfer counterpart. Anti-double counted!"
                            >
                              <ArrowRightLeft className="w-2.5 h-2.5" />
                              Transfer Pair
                            </span>
                          )}
                          {tx.isCreditCardPayment && (
                            <span
                              className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1 rounded flex items-center gap-0.5"
                              title="Credit card statement payment. Separated from card swipes!"
                            >
                              <CreditCard className="w-2.5 h-2.5" />
                              Card Pmt
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono line-clamp-1" title={tx.rawDescription}>
                          {tx.rawDescription}
                        </div>
                        {/* Anomalies alert banner */}
                        {hasAnomalies && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {tx.anomalies.map((anom) => (
                              <span
                                key={anom.id}
                                className="text-[9px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded flex items-center gap-1"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                {anom.message}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* 3. Amount Column */}
                      <td className="py-3 px-3 text-right whitespace-nowrap align-top">
                        <div
                          className={`font-mono font-bold text-sm ${
                            isInflow ? 'text-emerald-400' : 'text-slate-100'
                          }`}
                        >
                          {isInflow ? '+' : ''}
                          {formatCurrency(Math.abs(amountNum))}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {isInflow ? 'Inflow / Credit' : 'Outflow / Debit'}
                        </div>
                      </td>

                      {/* 4. Account */}
                      <td className="py-3 px-3 whitespace-nowrap align-top">
                        <div className="text-slate-200 font-medium truncate max-w-[150px]" title={tx.accountName}>
                          {tx.accountName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {tx.institution}
                        </div>
                      </td>

                      {/* 5. Classification Dropdown */}
                      <td className="py-3 px-3 whitespace-nowrap align-top">
                        <div className="flex items-center space-x-1.5">
                          <select
                            value={tx.classification}
                            onChange={(e) =>
                              handleReclassify(
                                tx.id,
                                e.target.value as TransactionClassification,
                                'Direct classification update via Transactions Hub'
                              )
                            }
                            className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer focus:outline-none ${
                              tx.classification === 'business'
                                ? 'bg-blue-950/60 text-blue-300 border-blue-500/30'
                                : tx.classification === 'income'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                                : tx.classification === 'transfer'
                                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
                                : tx.classification === 'debt_payment'
                                ? 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                                : tx.classification === 'personal'
                                ? 'bg-purple-950/60 text-purple-300 border-purple-500/30'
                                : tx.classification === 'reimbursement'
                                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30'
                                : 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {CLASSIFICATION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {isOverridden && (
                            <span
                              className="text-[9px] bg-slate-800 text-indigo-300 border border-indigo-500/20 px-1 rounded"
                              title="Manually overridden by user"
                            >
                              Manual
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Actions: Audit Trail, Revert, & Delete */}
                      <td className="py-3 px-3 text-center whitespace-nowrap align-top">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => onOpenAudit(tx.id)}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-500 transition cursor-pointer flex items-center space-x-1"
                            title="Why does this transaction have this classification?"
                          >
                            <HelpCircle className="w-3 h-3 text-indigo-400" />
                            <span>Why?</span>
                          </button>
                          {canRevert && (
                            <button
                              onClick={() => handleRevertClassification(tx.id)}
                              className="p-1 rounded text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 border border-amber-500/30 transition cursor-pointer"
                              title="Undo manual classification (Revert to prior state)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900 transition cursor-pointer"
                            title="Delete this transaction from ledger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bulk Classify Modal for Selected Rows */}
        {isClassifyModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      Classify {selectedTxIds.size} Selected Transactions
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Explicit row classification with audit note
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsClassifyModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleApplyBulkClassification} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Target Classification
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CLASSIFICATION_OPTIONS.filter((c) => c.value !== 'needs_review').map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBulkTargetClass(opt.value)}
                        className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                          bulkTargetClass === opt.value
                            ? 'bg-indigo-600/30 border-indigo-500 text-white font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Audit Note / Reason (recommended):
                  </label>
                  <input
                    type="text"
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    placeholder="e.g. Verified vendor recurring software bills for engineering team"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    This reason will be recorded on each transaction's audit trail and can be reverted anytime.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsClassifyModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Apply to {selectedTxIds.size} Rows</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Batch Classify Remaining as Personal Confirmation Modal */}
        {isBatchPersonalConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2 text-purple-300">
                  <UserCheck className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-sm text-slate-100">
                    Batch Mark Remaining as Personal
                  </h3>
                </div>
                <button
                  onClick={() => setIsBatchPersonalConfirmOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <p>
                  You have labeled your business transactions. This action will batch-mark all remaining{' '}
                  <strong className="text-purple-300">{unreviewedCount} unreviewed transactions</strong> as{' '}
                  <strong className="text-white">Personal Draw (Non-Business)</strong>.
                </p>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                  <div className="text-slate-400 flex items-center space-x-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Business expenses, transfers, income, and debt payments stay untouched</span>
                  </div>
                  <div className="text-slate-400 flex items-center space-x-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Personal expenses are excluded from business P&L</span>
                  </div>
                  <div className="text-slate-400 flex items-center space-x-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Permanent audit trail logged on each row with owner attribution</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Audit Note / Reason:
                  </label>
                  <input
                    type="text"
                    value={batchPersonalReason}
                    onChange={(e) => setBatchPersonalReason(e.target.value)}
                    placeholder="Owner verification reason"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIsBatchPersonalConfirmOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleBulkClassify('personal', batchPersonalReason);
                    setIsBatchPersonalConfirmOpen(false);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Confirm Batch Personal ({unreviewedCount})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        {pageSize !== 'all' && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border-t border-slate-800 text-xs">
            <span className="text-slate-400">
              Page {currentPage} of {totalPages} ({totalItems} total transactions)
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
