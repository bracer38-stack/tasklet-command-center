import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const LEDGER_FILE = path.join(DATA_DIR, 'shared_ledger.json');
const CONFIG_FILE = path.join(DATA_DIR, 'backup_config.json');

// Default candidate paths for Google Drive on Windows
const DEFAULT_DRIVE_PATH = 'G:\\My Drive\\TaskletBackups';

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export function getBackupConfig() {
  ensureDirs();
  const driveAvailable = fs.existsSync('G:\\My Drive');
  let config = {
    autoBackupEnabled: true,
    frequencyHours: 24,
    googleDrivePath: driveAvailable ? DEFAULT_DRIVE_PATH : '',
    googleDriveSyncEnabled: driveAvailable,
    lastBackupTime: null,
    lastBackupStatus: null,
  };

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      config = { ...config, ...saved };
    } catch (e) {
      console.error('Error reading backup config:', e);
    }
  } else {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch {}
  }

  return {
    ...config,
    isGoogleDriveDetected: driveAvailable,
  };
}

export function saveBackupConfig(newConfig) {
  ensureDirs();
  const current = getBackupConfig();
  const updated = { ...current, ...newConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function performBackup(reason = 'manual') {
  ensureDirs();
  if (!fs.existsSync(LEDGER_FILE)) {
    return { success: false, error: 'Ledger file does not exist yet.' };
  }

  const ledgerRaw = fs.readFileSync(LEDGER_FILE, 'utf8');
  const ledger = JSON.parse(ledgerRaw);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toISOString().replace(/[:.]/g, '-');

  // 1. Save timestamped & daily JSON
  const jsonDailyName = `tasklet_backup_${dateStr}.json`;
  const jsonDailyPath = path.join(BACKUPS_DIR, jsonDailyName);
  fs.writeFileSync(jsonDailyPath, ledgerRaw, 'utf8');

  const jsonLatestName = `tasklet_backup_latest.json`;
  const jsonLatestPath = path.join(BACKUPS_DIR, jsonLatestName);
  fs.writeFileSync(jsonLatestPath, ledgerRaw, 'utf8');

  // 2. Export Transactions CSV
  const txs = ledger.rawTransactions || [];
  const txHeader = [
    'transaction_id',
    'source_tx_id',
    'account_id',
    'account_name',
    'institution',
    'date',
    'amount',
    'currency',
    'pending',
    'status',
    'clean_merchant',
    'raw_description',
    'classification',
    'entity',
    'imported_at',
  ].join(',');

  const txRows = txs.map((t) => [
    escapeCsvField(t.id),
    escapeCsvField(t.sourceTxId || t.id),
    escapeCsvField(t.accountId),
    escapeCsvField(t.accountName),
    escapeCsvField(t.institution),
    escapeCsvField(t.date),
    escapeCsvField(t.amount),
    escapeCsvField(t.currency || 'USD'),
    escapeCsvField(t.pending ? 'true' : 'false'),
    escapeCsvField(t.status || 'posted'),
    escapeCsvField(t.cleanMerchant || t.merchantName || ''),
    escapeCsvField(t.rawDescription || ''),
    escapeCsvField(t.classification || 'needs_review'),
    escapeCsvField(t.entity || 'unknown'),
    escapeCsvField(t.importedAt || ''),
  ].join(','));

  const txCsvName = `tasklet_transactions_${dateStr}.csv`;
  const txCsvPath = path.join(BACKUPS_DIR, txCsvName);
  fs.writeFileSync(txCsvPath, [txHeader, ...txRows].join('\n'), 'utf8');

  // 3. Export Accounts CSV
  const accs = ledger.rawAccounts || [];
  const accHeader = [
    'account_id',
    'account_name',
    'official_name',
    'institution',
    'mask',
    'type',
    'subtype',
    'current_balance',
    'available_balance',
    'credit_limit',
    'is_business',
    'entity',
    'status',
    'is_stale',
    'last_synced_at',
  ].join(',');

  const accRows = accs.map((a) => [
    escapeCsvField(a.id),
    escapeCsvField(a.name),
    escapeCsvField(a.officialName || a.name),
    escapeCsvField(a.institution),
    escapeCsvField(a.mask),
    escapeCsvField(a.type),
    escapeCsvField(a.subtype),
    escapeCsvField(a.currentBalance),
    escapeCsvField(a.availableBalance ?? a.currentBalance),
    escapeCsvField(a.creditLimit ?? ''),
    escapeCsvField(a.isBusiness ? 'true' : 'false'),
    escapeCsvField(a.entity || 'unknown'),
    escapeCsvField(a.status || 'active'),
    escapeCsvField(a.isStale ? 'true' : 'false'),
    escapeCsvField(a.lastSyncedAt || ''),
  ].join(','));

  const accCsvName = `tasklet_accounts_${dateStr}.csv`;
  const accCsvPath = path.join(BACKUPS_DIR, accCsvName);
  fs.writeFileSync(accCsvPath, [accHeader, ...accRows].join('\n'), 'utf8');

  // 4. Google Drive Synchronization
  const config = getBackupConfig();
  let driveSynced = false;
  let driveSyncError = null;
  const driveFilesCopied = [];

  if (config.googleDriveSyncEnabled && config.googleDrivePath) {
    try {
      if (!fs.existsSync(config.googleDrivePath)) {
        fs.mkdirSync(config.googleDrivePath, { recursive: true });
      }

      // Copy files to Google Drive
      fs.copyFileSync(jsonDailyPath, path.join(config.googleDrivePath, jsonDailyName));
      fs.copyFileSync(jsonLatestPath, path.join(config.googleDrivePath, jsonLatestName));
      fs.copyFileSync(txCsvPath, path.join(config.googleDrivePath, txCsvName));
      fs.copyFileSync(accCsvPath, path.join(config.googleDrivePath, accCsvName));

      driveFilesCopied.push(jsonDailyName, jsonLatestName, txCsvName, accCsvName);
      driveSynced = true;
    } catch (e) {
      driveSyncError = e.message;
      console.error('Google Drive backup sync error:', e);
    }
  }

  // Update config with last backup info
  const backupSummary = {
    timestamp: now.toISOString(),
    reason,
    totalTransactions: txs.length,
    totalAccounts: accs.length,
    localFiles: [jsonDailyName, txCsvName, accCsvName],
    driveSynced,
    driveSyncError,
    drivePath: config.googleDrivePath,
  };

  saveBackupConfig({
    lastBackupTime: now.toISOString(),
    lastBackupStatus: driveSynced ? 'Synced to Google Drive & Local' : 'Local Backup Created',
  });

  return {
    success: true,
    summary: backupSummary,
  };
}

export function listBackups() {
  ensureDirs();
  const files = fs.readdirSync(BACKUPS_DIR);
  const backups = files.map((f) => {
    const fullPath = path.join(BACKUPS_DIR, f);
    const stat = fs.statSync(fullPath);
    return {
      fileName: f,
      sizeBytes: stat.size,
      sizeKb: (stat.size / 1024).toFixed(1),
      modifiedAt: stat.mtime.toISOString(),
      type: f.endsWith('.json') ? 'json' : f.endsWith('.csv') ? 'csv' : 'other',
    };
  }).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

  return backups;
}
