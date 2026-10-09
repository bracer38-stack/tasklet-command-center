import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  FileText,
  GitCompare,
  Upload,
  RotateCcw,
  ShieldAlert,
  Building2,
  CheckCircle2,
  Trash2,
  Pencil,
  Check,
  X,
  Download,
  Bot,
  Cloud,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { DataModeBadge } from './DataModeBadge';
import { BackupManagerModal } from './BackupManagerModal';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBriefing: () => void;
  onOpenWhatChanged: () => void;
  onOpenIngest: () => void;
  onOpenAiAgent?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenBriefing,
  onOpenWhatChanged,
  onOpenIngest,
  onOpenAiAgent,
}) => {
  const {
    isSyncing,
    handleSyncNow,
    handleResetData,
    handleClearData,
    handlePurgeAllFixtures,
    handleExportAuditPackage,
    dataMode,
    briefing,
    lastSyncTime,
    businessName,
    setBusinessName,
    isDemoData,
    dataHealth,
    latestReconciliationReport,
    activeEntity,
    setActiveEntity,
  } = useFinancial();

  const [isEditingBizName, setIsEditingBizName] = useState(false);
  const [bizNameInput, setBizNameInput] = useState(businessName);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  useEffect(() => {
    setBizNameInput(businessName);
  }, [businessName]);

  const handleSaveBizName = () => {
    if (bizNameInput.trim()) {
      setBusinessName(bizNameInput.trim());
    }
    setIsEditingBizName(false);
  };

  const minutesAgo = Math.max(
    1,
    Math.round((Date.now() - new Date(lastSyncTime).getTime()) / (1000 * 60))
  );

  const staleCount = briefing.syncHealth.staleCount;
  const reviewCount = briefing.reviewItems.needsReviewCount + briefing.reviewItems.anomaliesCount;

  const navItems = [
    { id: 'overview', label: 'Command Overview' },
    { id: 'transactions', label: 'Transactions Hub' },
    { id: 'cards-loans', label: 'Cards & Loans' },
    { id: 'subscriptions', label: 'Subscriptions' },
    {
      id: 'anomalies',
      label: 'Anomalies & Review',
      badge: reviewCount > 0 ? reviewCount : undefined,
    },
    {
      id: 'data-health',
      label: 'Data Health & Integrity',
      badge: `${dataHealth.overallConfidenceScore}%`,
    },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-40 backdrop-blur-md">
      {/* Persistent Mode Banner */}
      {dataMode === 'demo' && (
        <div className="bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-amber-950/80 border-b border-amber-500/40 px-4 py-1.5 text-center text-xs text-amber-200 flex items-center justify-center gap-2">
          <span className="px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 font-bold text-[10px] uppercase tracking-wider border border-amber-400/40">
            Demo Mode Active
          </span>
          <span>
            Simulated Acme Labs ledger loaded. Real bank data is not connected. Upload your CSV statement or click "Purge Fixtures" to manage your real business.
          </span>
        </div>
      )}

      {dataMode === 'unknown_freshness' && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border-b border-indigo-500/30 px-4 py-1.5 text-center text-xs text-indigo-200 flex items-center justify-center gap-2">
          <span className="px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200 font-bold text-[10px] uppercase tracking-wider border border-indigo-400/40">
            Clean Ledger Slate
          </span>
          <span>
            All fixtures purged (0 accounts). Financial calculations will resume as soon as source records are imported.
          </span>
        </div>
      )}

      {/* Top Banner / Actions Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Entity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-xl ring-1 ring-white/20">
              T
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  Tasklet Financial Command Center
                </h1>
                <DataModeBadge onOpenIngest={onOpenIngest} />
              </div>

              {/* Business Name with Click-to-Edit & Freshness Timestamp */}
              <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                {isEditingBizName ? (
                  <div className="flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <input
                      type="text"
                      value={bizNameInput}
                      onChange={(e) => setBizNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveBizName();
                        if (e.key === 'Escape') setIsEditingBizName(false);
                      }}
                      autoFocus
                      placeholder="Your Business Name"
                      className="bg-slate-950 border border-indigo-500 rounded px-2 py-0.5 text-xs text-slate-100 font-medium focus:outline-none w-48 shadow-inner"
                    />
                    <button
                      onClick={handleSaveBizName}
                      className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 cursor-pointer transition"
                      title="Save name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsEditingBizName(false)}
                      className="p-1 rounded text-slate-400 hover:bg-slate-800 cursor-pointer transition"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingBizName(true)}
                    className="flex items-center space-x-1 group hover:text-white transition cursor-pointer text-left"
                    title="Click to rename business"
                  >
                    <Building2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
                    <span className="text-slate-300 group-hover:text-white font-medium border-b border-dashed border-slate-700 pb-0.5">
                      {businessName}
                    </span>
                    <Pencil className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 group-hover:text-indigo-400 ml-0.5 transition" />
                  </button>
                )}

                <span>•</span>
                <span>{briefing.syncHealth.totalAccounts} accounts</span>
                <span>•</span>
                {staleCount > 0 ? (
                  <span className="flex items-center space-x-1 text-amber-400 font-medium">
                    <ShieldAlert className="w-3 h-3" />
                    <span>{staleCount} feed needs attention</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Feeds synced ({minutesAgo}m ago)</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Command Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Entity Filter Toggle */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveEntity('all')}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                  activeEntity === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View combined finances"
              >
                All
              </button>
              <button
                onClick={() => setActiveEntity('business')}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                  activeEntity === 'business'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View business operating entity only"
              >
                Business
              </button>
              <button
                onClick={() => setActiveEntity('personal')}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                  activeEntity === 'personal'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View personal / household entity only"
              >
                Personal
              </button>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
              title="Refresh feeds and recalculate financial liquidity"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {onOpenAiAgent && (
              <button
                onClick={onOpenAiAgent}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-indigo-950/40 border border-purple-400/30 transition cursor-pointer"
                title="Open Tasklet AI Agent Copilot (Ctrl+J)"
              >
                <Bot className="w-3.5 h-3.5 text-purple-200" />
                <span>AI Agent</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </button>
            )}

            <button
              onClick={onOpenBriefing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Daily Briefing</span>
              {reviewCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={onOpenWhatChanged}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5 text-violet-400" />
              <span>What Changed?</span>
            </button>

            {/* Traceable Financial Data Export (Requirement 10) */}
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5">
              <button
                onClick={() => handleExportAuditPackage('json')}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold text-cyan-300 hover:text-white hover:bg-slate-750 transition cursor-pointer"
                title="Download JSON lineage manifest tracing every metric to source records"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export JSON</span>
              </button>
              <span className="text-slate-600 text-xs">|</span>
              <button
                onClick={() => handleExportAuditPackage('csv')}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold text-emerald-300 hover:text-white hover:bg-slate-750 transition cursor-pointer"
                title="Download unified CSV with record_type columns"
              >
                <span>CSV</span>
              </button>
            </div>

            {/* Daily Backup & Google Drive Button */}
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-950/40 hover:bg-blue-900/50 text-blue-200 border border-blue-500/30 transition shadow-sm shadow-blue-950/40 cursor-pointer"
              title="Daily Automated Backups & Google Drive Cloud Sync"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span>Daily Backup & Drive</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </button>

            {/* Reset Ledger Button (Only visible when imported accounts exist) */}
            {briefing.syncHealth.totalAccounts > 0 && (
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear all imported records and reset the ledger?")) {
                    handlePurgeAllFixtures();
                  }
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                title="Reset ledger and clear imported records"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Reset Ledger</span>
              </button>
            )}

            {/* Prominent Upload CSV / Statements Button */}
            <button
              onClick={onOpenIngest}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400/30 transition cursor-pointer"
              title="Upload your multi-record-type CSV or Plaid statement"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Statement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <nav className="flex space-x-1 overflow-x-auto py-1.5 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-indigo-400 shadow-sm border border-slate-700/60 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <BackupManagerModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </header>
  );
};
