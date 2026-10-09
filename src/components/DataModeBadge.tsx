import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  Trash2,
  RotateCcw,
  Upload,
  Clock,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { DataMode } from '../types';

interface DataModeBadgeProps {
  onOpenIngest?: () => void;
}

export const DataModeBadge: React.FC<DataModeBadgeProps> = ({ onOpenIngest }) => {
  const {
    dataMode,
    setDataMode,
    accounts,
    transactions,
    subscriptions,
    notes,
    lastSyncTime,
    handlePurgeAllFixtures,
  } = useFinancial();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBadgeConfig = (mode: DataMode) => {
    switch (mode) {
      case 'demo':
        return {
          label: 'Demo Mode',
          subtext: 'Acme Labs Fixtures',
          icon: Database,
          pillClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
          dotClass: 'bg-amber-400',
          ringClass: 'ring-amber-500/20',
        };
      case 'imported_csv':
        return {
          label: 'Imported CSV',
          subtext: 'Reconciled Statements',
          icon: FileSpreadsheet,
          pillClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/25',
          dotClass: 'bg-cyan-400',
          ringClass: 'ring-cyan-500/20',
        };
      case 'connected_live':
        return {
          label: 'Connected / Live',
          subtext: 'Active Bank Webhook',
          icon: CheckCircle2,
          pillClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
          dotClass: 'bg-emerald-400 animate-pulse',
          ringClass: 'ring-emerald-500/20',
        };
      case 'stale_disconnected':
        return {
          label: 'Stale / Disconnected',
          subtext: 'Sync Interrupted (>72h)',
          icon: AlertTriangle,
          pillClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25',
          dotClass: 'bg-rose-400',
          ringClass: 'ring-rose-500/20',
        };
      case 'unknown_freshness':
      default:
        return {
          label: 'Unknown Freshness',
          subtext: 'Awaiting Source Verification',
          icon: HelpCircle,
          pillClass: 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750',
          dotClass: 'bg-slate-400',
          ringClass: 'ring-slate-700/40',
        };
    }
  };

  const config = getBadgeConfig(dataMode);
  const IconComponent = config.icon;

  const minutesAgo = Math.max(
    1,
    Math.round((Date.now() - new Date(lastSyncTime).getTime()) / (1000 * 60))
  );

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition shadow-sm cursor-pointer ${config.pillClass}`}
        title="View data mode and source verification status"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
        <IconComponent className="w-3.5 h-3.5" />
        <span className="tracking-wide">{config.label}</span>
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-4 z-50 text-slate-200 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${config.dotClass}`} />
              <div className="font-bold text-xs text-slate-100">{config.label}</div>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Active Mode
            </span>
          </div>

          <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
            {dataMode === 'demo' &&
              'Simulated Acme Labs dataset active. Used for evaluating liquidity waterfalls, utilization thresholds, and audit trails without personal data.'}
            {dataMode === 'imported_csv' &&
              'Ledger and accounts populated from your uploaded statements. Unclassified transactions default to Needs Review.'}
            {dataMode === 'connected_live' &&
              'Direct financial institution feed connected via verified bank link.'}
            {dataMode === 'stale_disconnected' &&
              'Institution feeds have not synced within the 72-hour freshness threshold.'}
            {dataMode === 'unknown_freshness' &&
              'No verified source records loaded. Financial calculations are suppressed until valid data is ingested.'}
          </p>

          {/* Counts & Source Freshness */}
          <div className="mt-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Verified Accounts:</span>
              </span>
              <span className="font-mono font-semibold text-slate-200">{accounts.length}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ledger Transactions:</span>
              </span>
              <span className="font-mono font-semibold text-slate-200">{transactions.length}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Last Ingest / Sync:</span>
              </span>
              <span className="font-mono text-slate-300">{minutesAgo}m ago</span>
            </div>
          </div>

          {/* Switch Modes Selector */}
          <div className="mt-3 pt-3 border-t border-slate-800/80">
            <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
              Change Data State
            </span>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <button
                onClick={() => {
                  setDataMode('demo');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 text-left rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                  dataMode === 'demo'
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                Demo
              </button>
              <button
                onClick={() => {
                  setDataMode('imported_csv');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 text-left rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                  dataMode === 'imported_csv'
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                Imported CSV
              </button>
              <button
                onClick={() => {
                  setDataMode('connected_live');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 text-left rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                  dataMode === 'connected_live'
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                Connected / Live
              </button>
              <button
                onClick={() => {
                  setDataMode('stale_disconnected');
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 text-left rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                  dataMode === 'stale_disconnected'
                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                Stale / Disconnected
              </button>
            </div>
          </div>

          {/* Quick Action Footer */}
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            {accounts.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to reset the ledger and clear all loaded accounts?")) {
                    handlePurgeAllFixtures();
                    setIsOpen(false);
                  }
                }}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Reset Ledger</span>
              </button>
            )}

            {onOpenIngest && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenIngest();
                }}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shadow-sm"
              >
                <Upload className="w-3 h-3" />
                <span>Import Statement</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
