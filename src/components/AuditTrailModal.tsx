import React, { useState } from 'react';
import {
  X,
  History,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Tag,
  ArrowRightLeft,
  CreditCard,
  Save,
  RotateCcw,
  FileCheck2,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatDate } from '../services/normalization';
import { Transaction, TransactionClassification } from '../types';

interface AuditTrailModalProps {
  tx: Transaction | null;
  onClose: () => void;
}

const CLASSIFICATION_OPTIONS: { value: TransactionClassification; label: string; desc: string }[] = [
  { value: 'business', label: 'Business Expense', desc: 'Operating business expense, tax deductible' },
  { value: 'personal', label: 'Personal Draw / Expense', desc: 'Personal expenditure or owner equity draw' },
  { value: 'transfer', label: 'Internal Transfer', desc: 'Movement between own accounts; excluded from P&L' },
  { value: 'reimbursement', label: 'Reimbursement', desc: 'Out-of-pocket business expense on personal account' },
  { value: 'income', label: 'Business Income / Revenue', desc: 'Client payment or sales revenue' },
  { value: 'debt_payment', label: 'Debt Payment', desc: 'Principal/interest loan or credit card statement payment' },
  { value: 'needs_review', label: 'Needs Review', desc: 'Requires owner documentation or tax review' },
];

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({ tx, onClose }) => {
  const { handleReclassify, handleRevertClassification } = useFinancial();
  const [selectedClass, setSelectedClass] = useState<TransactionClassification>(
    tx?.classification || 'needs_review'
  );
  const [overrideReason, setOverrideReason] = useState<string>('');

  if (!tx) return null;

  const latestAudit = tx.auditTrail[0];
  const isInflow = tx.amount < 0;

  const onSaveOverride = () => {
    if (selectedClass !== tx.classification || overrideReason.trim()) {
      handleReclassify(
        tx.id,
        selectedClass,
        overrideReason.trim() || `Owner reclassified to ${selectedClass.replace('_', ' ')}`
      );
      setOverrideReason('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Classification Audit & Evidence Trail
              </h2>
              <span className="text-xs text-slate-400">
                Transaction ID: <code className="text-slate-300 font-mono">{tx.id}</code>
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
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Transaction Metadata Card */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Merchant</span>
              <div className="text-xs font-semibold text-slate-200 mt-0.5">{tx.cleanMerchant}</div>
              <div className="text-[10px] text-slate-400 font-mono truncate">{tx.rawDescription}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Account</span>
              <div className="text-xs font-semibold text-slate-200 mt-0.5">{tx.accountName}</div>
              <div className="text-[10px] text-slate-400">{tx.institution}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Amount</span>
              <div
                className={`text-sm font-bold font-mono mt-0.5 ${
                  isInflow ? 'text-emerald-400' : 'text-slate-100'
                }`}
              >
                {isInflow ? '+' : ''}
                {formatCurrency(Math.abs(tx.amount))}
              </div>
              <div className="text-[10px] text-slate-400">{formatDate(tx.date)}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Current Class</span>
              <div className="mt-0.5">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {tx.classification.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {tx.pending ? 'Status: Pending' : 'Status: Settled'}
              </div>
            </div>
          </div>

          {/* Special Anti-Double Count Details */}
          {tx.isTransferCounterpart && (
            <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl flex items-start space-x-2.5">
              <ArrowRightLeft className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-cyan-300">
                  Anti-Double Counting Protection Active
                </span>
                <p className="text-slate-300 mt-0.5">
                  This transaction is paired with counterpart transaction{' '}
                  <code className="text-cyan-200 font-mono">{tx.transferCounterpartId}</code>. It is
                  automatically omitted from business revenue and business expense calculations.
                </p>
              </div>
            </div>
          )}

          {tx.isCreditCardPayment && (
            <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-start space-x-2.5">
              <CreditCard className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-amber-300">
                  Credit Card Bill Payment Separation
                </span>
                <p className="text-slate-300 mt-0.5">
                  This payment settles card balances and is marked as Debt Payment. It does not
                  count as a duplicate business expense because card swipes are already recorded
                  individually.
                </p>
              </div>
            </div>
          )}

          {/* Rationale & Rule Evaluated */}
          {latestAudit && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  Classification Engine Decision: {latestAudit.ruleApplied}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Confidence: {Math.round(latestAudit.confidence * 100)}%
                </span>
              </div>
              <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                "{latestAudit.reasoning}"
              </p>
            </div>
          )}

          {/* Immutable Ingestion Evidence Card */}
          <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-1.5 text-xs">
            <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Immutable Ingestion Evidence & Provenance</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300">
              <div>
                <span className="text-slate-500 text-[10px] block">Source Tx ID:</span>
                <span className="truncate block" title={tx.sourceTxId || tx.id}>
                  {tx.sourceTxId || tx.id}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Import Batch ID:</span>
                <span className="truncate block" title={tx.importBatchId || 'batch_initial'}>
                  {tx.importBatchId || 'batch_initial'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Import Timestamp:</span>
                <span className="truncate block">
                  {tx.importedAt ? new Date(tx.importedAt).toLocaleDateString() : 'Initial Import'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Entity Association:</span>
                <span className="capitalize font-semibold text-indigo-300">
                  {tx.entity || 'business'}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Reclassification / Override */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                Override Classification
              </h3>
              {tx.auditTrail.some((a) => a.canRevert || (a.userOverridden && a.priorClassification)) && (
                <button
                  type="button"
                  onClick={() => handleRevertClassification(tx.id)}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition cursor-pointer"
                  title="Restore transaction to previous classification"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Revert Override</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedClass(opt.value)}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    selectedClass === opt.value
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Audit Trail Note / Justification (required for non-standard changes):
              </label>
              <input
                type="text"
                placeholder="e.g. Conference hotel stay for Q4 tech summit approved by CEO"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={onSaveOverride}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Apply Classification & Record in Audit Trail</span>
            </button>
          </div>

          {/* Chronological Audit Trail History */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-400" />
              Complete Decision Chronology ({tx.auditTrail.length} entries)
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {tx.auditTrail.map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-200">{entry.ruleApplied}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="text-[10px] text-slate-400">Classified as:</span>
                    <span className="font-semibold text-indigo-300">
                      {entry.assignedClassification.replace('_', ' ')}
                    </span>
                    {entry.actor && (
                      <span className="text-[9px] bg-slate-800 text-slate-300 px-1 rounded border border-slate-700">
                        Actor: {entry.actor}
                      </span>
                    )}
                    {entry.previousValue && entry.previousValue !== entry.assignedClassification && (
                      <span className="text-[9px] bg-slate-800 text-amber-300 px-1 rounded border border-slate-700">
                        {entry.previousValue} &rarr; {entry.assignedClassification}
                      </span>
                    )}
                    {entry.userOverridden && (
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded">
                        Manual Override
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{entry.reasoning}</p>
                </div>
              ))}
            </div>
          </div>
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
