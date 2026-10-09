import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Download,
  Folder,
  FileText,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface BackupItem {
  fileName: string;
  sizeBytes: number;
  sizeKb: string;
  modifiedAt: string;
  type: 'json' | 'csv' | 'other';
}

interface BackupConfig {
  autoBackupEnabled: boolean;
  frequencyHours: number;
  googleDrivePath: string;
  googleDriveSyncEnabled: boolean;
  lastBackupTime: string | null;
  lastBackupStatus: string | null;
  isGoogleDriveDetected: boolean;
}

interface BackupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupManagerModal: React.FC<BackupManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [customPath, setCustomPath] = useState('');

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/backups');
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setBackups(data.backups || []);
        if (data.config?.googleDrivePath) {
          setCustomPath(data.config.googleDrivePath);
        }
      }
    } catch (e) {
      console.error('Failed to fetch backup information', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    }
  }, [isOpen]);

  const handleRunBackup = async () => {
    setIsBackingUp(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/backups/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
        setConfig(data.config);
        const driveStatus = data.summary?.driveSynced
          ? '✓ Backed up & synced directly to Google Drive!'
          : '✓ Local backup created!';
        setFeedback(driveStatus);
      } else {
        setFeedback('Failed to execute backup.');
      }
    } catch (e: any) {
      setFeedback(`Error: ${e.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSavePath = async () => {
    try {
      const res = await fetch('/api/backups/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleDrivePath: customPath }),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        setFeedback('Updated Google Drive sync path successfully.');
      }
    } catch (e: any) {
      setFeedback(`Error saving path: ${e.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Daily Backup & Google Drive</span>
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Automated 24h ledger snapshots, CSV exports, and Google Drive Desktop cloud mirroring
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {feedback && (
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Sync Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Google Drive Status */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Folder className="w-4 h-4 text-blue-400" />
                  <span>Google Drive Sync</span>
                </span>
                {config?.googleDriveSyncEnabled ? (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                    Local Only
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Mirrors daily snapshots directly to your Google Drive Desktop folder for instant cross-device mobile backup.
              </p>
              <div className="text-[10px] font-mono text-slate-300 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 truncate" title={config?.googleDrivePath || 'G:\\My Drive\\TaskletBackups'}>
                {config?.googleDrivePath || 'G:\\My Drive\\TaskletBackups'}
              </div>
            </div>

            {/* Daily Schedule Status */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-indigo-400" />
                  <span>Automated Daily Snapshot</span>
                </span>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
                  Every 24 Hours
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Ledger data is automatically snapshotted on server startup, daily intervals, and whenever ledger updates occur.
              </p>
              <div className="text-[11px] text-slate-300">
                Last Backup:{' '}
                <span className="font-mono text-emerald-400 font-semibold">
                  {config?.lastBackupTime
                    ? new Date(config.lastBackupTime).toLocaleString()
                    : 'Just now'}
                </span>
              </div>
            </div>
          </div>

          {/* Trigger Backup Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-950/30 via-slate-900 to-indigo-950/30 border border-blue-500/20">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-slate-100">
                Create Instant Backup Snapshot
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Takes an immediate full JSON snapshot and CSV export, saving locally and copying to Google Drive.
              </p>
            </div>
            <button
              onClick={handleRunBackup}
              disabled={isBackingUp}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-950/50 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
              <span>{isBackingUp ? 'Creating Backup...' : 'Backup Now to Drive'}</span>
            </button>
          </div>

          {/* Quick Direct Downloads */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-300">
              Quick Downloads
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <a
                href="/api/backups/download?file=tasklet_backup_latest.json"
                download
                className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition flex items-center justify-between text-xs text-slate-200 group"
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span className="truncate font-medium">Full Ledger (JSON)</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition" />
              </a>

              <a
                href={`/api/backups/download?file=tasklet_transactions_${new Date().toISOString().split('T')[0]}.csv`}
                download
                className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition flex items-center justify-between text-xs text-slate-200 group"
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="truncate font-medium">Transactions (CSV)</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
              </a>

              <a
                href={`/api/backups/download?file=tasklet_accounts_${new Date().toISOString().split('T')[0]}.csv`}
                download
                className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition flex items-center justify-between text-xs text-slate-200 group"
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span className="truncate font-medium">Accounts (CSV)</span>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
              </a>
            </div>
          </div>

          {/* Backup History Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-300">
                Backup Archives ({backups.length} Files Available)
              </h4>
              <button
                onClick={fetchBackups}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh List</span>
              </button>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">File Name</th>
                    <th className="py-2 px-3">Size</th>
                    <th className="py-2 px-3">Modified</th>
                    <th className="py-2 px-3 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {backups.map((b) => (
                    <tr key={b.fileName} className="hover:bg-slate-900/40 transition">
                      <td className="py-2 px-3 text-slate-200 flex items-center gap-1.5 truncate max-w-[220px]">
                        <span className={`w-1.5 h-1.5 rounded-full ${b.type === 'json' ? 'bg-cyan-400' : 'bg-emerald-400'}`} />
                        <span className="truncate">{b.fileName}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{b.sizeKb} KB</td>
                      <td className="py-2 px-3 text-slate-400 text-[10px]">
                        {new Date(b.modifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <a
                          href={`/api/backups/download?file=${encodeURIComponent(b.fileName)}`}
                          download
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                        >
                          <Download className="w-2.5 h-2.5" />
                          <span>Get</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                  {backups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-500">
                        No backups created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/60 text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Google Drive for Desktop sync active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
