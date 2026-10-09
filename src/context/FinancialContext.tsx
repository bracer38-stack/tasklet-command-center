import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
import {
  Account,
  DailyBriefing,
  DataMode,
  FilterState,
  FinancialDataHealth,
  FinancialNote,
  ImportReconciliationSummary,
  MetricLineage,
  ReconciliationReport,
  Subscription,
  SyncDiff,
  Transaction,
  TransactionClassification,
  UtilizationThresholds,
} from '../types';
import { detectTransfers } from '../services/transferEngine';
import { detectAnomalies } from '../services/anomalyEngine';
import { detectSubscriptions } from '../services/subscriptionEngine';
import { generateDailyBriefing } from '../services/briefingEngine';
import { computeSyncDiff } from '../services/syncDiffEngine';
import { reclassifyTransaction, revertTransactionClassification } from '../services/classificationEngine';
import { DEFAULT_THRESHOLDS } from '../services/creditEngine';
import { reconcileFinancialState } from '../services/reconciliationEngine';
import { rawIngestionStore } from '../services/rawIngestionStore';
import { evaluateDataHealth } from '../services/dataHealthEngine';
import { deriveMetricLineage } from '../services/lineageEngine';
import {
  buildFinancialExportManifest,
  exportTraceableJson,
  exportTraceableCsv,
} from '../services/financialExport';

interface FinancialContextType {
  accounts: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  monthlyBurnRate: number;
  annualBurnRate: number;
  briefing: DailyBriefing;
  latestDiff: SyncDiff | null;
  latestReconciliationReport: ReconciliationReport | null;
  dataHealth: FinancialDataHealth;
  thresholds: UtilizationThresholds;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  setThresholds: React.Dispatch<React.SetStateAction<UtilizationThresholds>>;
  businessName: string;
  setBusinessName: (name: string) => void;
  isDemoData: boolean;
  activeEntity: 'all' | 'business' | 'personal';
  setActiveEntity: (entity: 'all' | 'business' | 'personal') => void;
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  notes: FinancialNote[];
  handleAddNote: (note: FinancialNote) => void;
  handleDeleteNote: (noteId: string) => void;
  handlePurgeAllFixtures: () => void;
  handleCommitRecordTypeImport: (
    summary: ImportReconciliationSummary,
    mode: 'replace' | 'append',
    customBusinessName?: string
  ) => void;
  handleExportAuditPackage: (format: 'json' | 'csv') => void;
  isDataValid: boolean;
  handleReclassify: (
    txId: string,
    newClassification: TransactionClassification,
    reasoning?: string
  ) => void;
  handleClassifySelected: (
    txIds: string[],
    targetClassification: TransactionClassification,
    reason: string
  ) => void;
  handleRevertClassification: (txId: string) => void;
  handleSyncNow: () => void;
  handleResolveStaleAccount: (accountId: string) => void;
  handleResolveAnomaly: (txId: string, anomalyId: string) => void;
  handleIngestData: (
    newAccounts: Account[],
    newTransactions: Transaction[],
    rawPayloadString?: string,
    format?: 'plaid_json' | 'plaid_csv',
    replaceExisting?: boolean,
    customBusinessName?: string
  ) => ReconciliationReport;
  handleResetData: () => void;
  handleClearData: () => void;
  handleUpdateAccount: (accountId: string, updates: Partial<Account>) => void;
  handleAddAccount: (account: Account) => void;
  handleDeleteAccount: (accountId: string) => void;
  handlePurgeAllDemoAccounts: () => void;
  handleDeleteTransaction: (txId: string) => void;
  handleBulkClassify: (targetClassification?: TransactionClassification, reason?: string) => void;
  handlePurgeDemoArtifacts: () => void;
  handleUpdateSubscription: (subId: string, updates: Partial<Subscription>) => void;
  handleDeleteSubscription: (subId: string) => void;
  handleAddSubscription: (newSub: Subscription) => void;
  selectedTxForAudit: Transaction | null;
  setSelectedTxForAudit: (tx: Transaction | null) => void;
  selectedMetricLineage: MetricLineage | null;
  handleInspectMetric: (metricKey: string) => void;
  clearMetricLineage: () => void;
  isSyncing: boolean;
  lastSyncTime: string;
}

const FinancialContext = createContext<FinancialContextType | null>(null);

const STORAGE_KEY_ACCOUNTS = 'tasklet_accounts_v2';
const STORAGE_KEY_TRANSACTIONS = 'tasklet_transactions_v2';
const STORAGE_KEY_THRESHOLDS = 'tasklet_thresholds_v2';
const STORAGE_KEY_LAST_SYNC = 'tasklet_last_sync_v2';
const STORAGE_KEY_RECON = 'tasklet_recon_report_v2';
const STORAGE_KEY_BIZ_NAME = 'tasklet_biz_name_v2';
const STORAGE_KEY_DATA_MODE = 'tasklet_data_mode_v2';
const STORAGE_KEY_NOTES = 'tasklet_notes_v2';

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Business name state
  const [businessName, setBusinessName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BIZ_NAME);
      if (saved && saved !== 'Acme Labs & Holdings LLC') return saved;
    } catch {}
    return 'My Business';
  });

  // Load persisted state or default to pristine empty state (mock fixtures permanently removed)
  const [rawAccounts, setRawAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isMock = parsed.some((a) => a.id === 'acc_mercury_op' || a.id === 'acc_sba_loan');
          if (!isMock) return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load accounts from storage', e);
    }
    return [];
  });

  const [rawTransactions, setRawTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isMock = parsed.some(
            (t) =>
              t.id === 'tx_pend_01' ||
              t.cleanMerchant?.includes('Gary Danko') ||
              t.rawDescription?.includes('HYATT REGENCY')
          );
          if (!isMock) return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load transactions from storage', e);
    }
    return [];
  });

  const [dataMode, setDataMode] = useState<DataMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DATA_MODE) as DataMode;
      if (saved && saved !== 'demo') return saved;
    } catch {}
    return 'unknown_freshness';
  });

  const [notes, setNotes] = useState<FinancialNote[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NOTES);
      if (saved) {
        const parsed = JSON.parse(saved);
        const isMockNote = Array.isArray(parsed) && parsed.some((n: any) => n.id?.startsWith('note_fixture'));
        if (!isMockNote) return parsed;
      }
    } catch {}
    return [];
  });

  const isDemoData = useMemo(() => {
    return dataMode === 'demo' || rawAccounts.some((a) => a.id === 'acc_mercury_op');
  }, [dataMode, rawAccounts]);

  const isDataValid = useMemo(() => {
    return rawAccounts.length > 0 && dataMode !== 'unknown_freshness';
  }, [rawAccounts.length, dataMode]);

  const [thresholds, setThresholds] = useState<UtilizationThresholds>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THRESHOLDS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load thresholds', e);
    }
    return DEFAULT_THRESHOLDS;
  });

  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
      if (saved) return saved;
    } catch {
      // fallback
    }
    return new Date(Date.now() - 14 * 60 * 1000).toISOString();
  });

  const [latestReconciliationReport, setLatestReconciliationReport] =
    useState<ReconciliationReport | null>(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_RECON);
        if (saved) return JSON.parse(saved);
      } catch {
        // fallback
      }
      return null;
    });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [latestDiff, setLatestDiff] = useState<SyncDiff | null>(null);
  const [selectedTxForAudit, setSelectedTxForAudit] = useState<Transaction | null>(null);
  const [selectedMetricLineage, setSelectedMetricLineage] = useState<MetricLineage | null>(null);

  // Subscription manual overrides and custom subscriptions
  const [subOverrides, setSubOverrides] = useState<Record<string, Partial<Subscription>>>(() => {
    try {
      const saved = localStorage.getItem('tasklet_sub_overrides_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [customSubscriptions, setCustomSubscriptions] = useState<Subscription[]>(() => {
    try {
      const saved = localStorage.getItem('tasklet_custom_subs_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [deletedSubIds, setDeletedSubIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tasklet_deleted_subs_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [activeEntity, setActiveEntity] = useState<'all' | 'business' | 'personal'>('all');

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    classification: 'all',
    accountId: 'all',
    entity: 'all',
    hasAnomalyOnly: false,
    dateRange: 'all',
  });

  const hasHydratedServerRef = useRef(false);

  // Load shared ledger from server if available (enabling seamless mobile & desktop sync)
  useEffect(() => {
    let isMounted = true;
    async function loadServerLedger() {
      try {
        const res = await fetch('/api/ledger');
        if (res.ok) {
          const data = await res.json();
          if (data && data.exists !== false && Array.isArray(data.rawAccounts)) {
            // Check if server data contains legacy mock fixtures (Mercury, SBA loan, Gary Danko, Acme Labs)
            const isMockData =
              data.businessName === 'Acme Labs & Holdings LLC' ||
              data.rawAccounts.some((a: any) => a.id === 'acc_mercury_op' || a.id === 'acc_sba_loan') ||
              data.rawTransactions?.some((t: any) => t.id === 'tx_pend_01' || t.cleanMerchant?.includes('Gary Danko'));

            if (isMockData) {
              // Immediately purge mock data from server and keep pristine clean state
              fetch('/api/ledger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  exists: true,
                  rawAccounts: [],
                  rawTransactions: [],
                  thresholds: DEFAULT_THRESHOLDS,
                  lastSyncTime: null,
                  businessName: 'My Business',
                  dataMode: 'unknown_freshness',
                  notes: [],
                  subOverrides: {},
                  customSubscriptions: [],
                  deletedSubIds: [],
                  latestReconciliationReport: null,
                  updatedAt: new Date().toISOString(),
                }),
              }).catch(() => {});
              setRawAccounts([]);
              setRawTransactions([]);
              setNotes([]);
              setBusinessName('My Business');
              setDataMode('unknown_freshness');
              return;
            }

            if (!isMounted) return;
            setRawAccounts(data.rawAccounts);
            if (Array.isArray(data.rawTransactions)) setRawTransactions(data.rawTransactions);
            if (data.thresholds) setThresholds(data.thresholds);
            if (data.businessName) setBusinessName(data.businessName);
            if (data.dataMode) setDataMode(data.dataMode);
            if (Array.isArray(data.notes)) setNotes(data.notes);
            if (data.lastSyncTime) setLastSyncTime(data.lastSyncTime);
            if (Array.isArray(data.customSubscriptions)) setCustomSubscriptions(data.customSubscriptions);
            if (data.subOverrides) setSubOverrides(data.subOverrides);
            if (data.latestReconciliationReport) setLatestReconciliationReport(data.latestReconciliationReport);
          }
        }
      } catch (err) {
        // Fallback to local storage if offline or during testing
      } finally {
        if (isMounted) {
          hasHydratedServerRef.current = true;
        }
      }
    }
    loadServerLedger();
    return () => {
      isMounted = false;
    };
  }, []);

  // Persist state changes locally and sync to shared server endpoint
  useEffect(() => {
    if (!hasHydratedServerRef.current) {
      return; // Do not overwrite server before initial hydration finishes
    }

    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(rawAccounts));
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(rawTransactions));
      localStorage.setItem(STORAGE_KEY_THRESHOLDS, JSON.stringify(thresholds));
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, lastSyncTime);
      localStorage.setItem(STORAGE_KEY_BIZ_NAME, businessName);
      localStorage.setItem(STORAGE_KEY_DATA_MODE, dataMode);
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
      localStorage.setItem('tasklet_sub_overrides_v2', JSON.stringify(subOverrides));
      localStorage.setItem('tasklet_custom_subs_v2', JSON.stringify(customSubscriptions));
      localStorage.setItem('tasklet_deleted_subs_v2', JSON.stringify(deletedSubIds));
      if (latestReconciliationReport) {
        localStorage.setItem(STORAGE_KEY_RECON, JSON.stringify(latestReconciliationReport));
      }
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }

    // Debounced sync to shared server endpoint
    const timer = setTimeout(() => {
      try {
        const payload = {
          exists: true,
          rawAccounts,
          rawTransactions,
          thresholds,
          lastSyncTime,
          businessName,
          dataMode,
          notes,
          subOverrides,
          customSubscriptions,
          deletedSubIds,
          latestReconciliationReport,
          updatedAt: new Date().toISOString(),
        };
        fetch('/api/ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch {}
    }, 400);

    return () => clearTimeout(timer);
  }, [
    rawAccounts,
    rawTransactions,
    thresholds,
    lastSyncTime,
    latestReconciliationReport,
    businessName,
    dataMode,
    notes,
    subOverrides,
    customSubscriptions,
    deletedSubIds,
  ]);

  // Run full financial engine pipelines
  const { processedAccounts, processedTransactions, subscriptions, monthlyBurnRate, annualBurnRate } =
    useMemo(() => {
      // 1. Detect internal transfers and card payments
      const { updatedTransactions: afterTransfers } = detectTransfers(
        rawTransactions,
        rawAccounts
      );

      // 2. Detect anomalies and classification anomalies
      const afterAnomalies = detectAnomalies(afterTransfers, rawAccounts);

      // 3. Detect subscriptions & recurring burn rate
      const subResult = detectSubscriptions(afterAnomalies);
      const deletedSet = new Set(deletedSubIds);

      const mergedDetected = subResult.subscriptions
        .filter((s) => !deletedSet.has(s.id))
        .map((s) => {
          const override = subOverrides[s.id];
          if (override) {
            return { ...s, ...override, userOverridden: true };
          }
          return s;
        });

      const allSubscriptions = [...mergedDetected, ...customSubscriptions];

      let monthlyBurnRate = 0;
      for (const s of allSubscriptions) {
        if (s.frequency === 'weekly') monthlyBurnRate += s.lastAmount * 4.33;
        else if (s.frequency === 'monthly') monthlyBurnRate += s.lastAmount;
        else if (s.frequency === 'quarterly') monthlyBurnRate += s.lastAmount / 3;
        else if (s.frequency === 'annual') monthlyBurnRate += s.lastAmount / 12;
      }
      const annualBurnRate = monthlyBurnRate * 12;

      return {
        processedAccounts: rawAccounts,
        processedTransactions: afterAnomalies,
        subscriptions: allSubscriptions,
        monthlyBurnRate,
        annualBurnRate,
      };
    }, [rawAccounts, rawTransactions, subOverrides, customSubscriptions, deletedSubIds]);

  // Generate Daily Briefing
  const briefing = useMemo(() => {
    return generateDailyBriefing(
      processedAccounts,
      processedTransactions,
      subscriptions
    );
  }, [processedAccounts, processedTransactions, subscriptions]);

  // Evaluate Financial Data Health
  const dataHealth = useMemo(() => {
    return evaluateDataHealth(processedAccounts, processedTransactions);
  }, [processedAccounts, processedTransactions]);

  // Inspect Metric Lineage ("Why does this number say $X?")
  const handleInspectMetric = (metricKey: string) => {
    const lineage = deriveMetricLineage(
      metricKey,
      processedAccounts,
      processedTransactions,
      subscriptions,
      briefing.upcomingObligations
    );
    setSelectedMetricLineage(lineage);
  };

  const clearMetricLineage = () => {
    setSelectedMetricLineage(null);
  };

  // Classification override
  const handleReclassify = (
    txId: string,
    newClassification: TransactionClassification,
    reasoning?: string
  ) => {
    setRawTransactions((prev) =>
      prev.map((t) => {
        if (t.id === txId) {
          const updated = reclassifyTransaction(t, newClassification, reasoning);
          if (selectedTxForAudit?.id === txId) {
            setSelectedTxForAudit(updated);
          }
          return updated;
        }
        return t;
      })
    );
  };

  // Classify explicitly selected transactions with mandatory reason
  const handleClassifySelected = (
    txIds: string[],
    targetClassification: TransactionClassification,
    reason: string
  ) => {
    const idSet = new Set(txIds);
    setRawTransactions((prev) =>
      prev.map((t) => {
        if (idSet.has(t.id)) {
          const updated = reclassifyTransaction(
            t,
            targetClassification,
            reason,
            'Owner / Selected Rows Action'
          );
          if (selectedTxForAudit?.id === t.id) {
            setSelectedTxForAudit(updated);
          }
          return updated;
        }
        return t;
      })
    );
  };

  // Revert a transaction's manual classification back to prior state
  const handleRevertClassification = (txId: string) => {
    setRawTransactions((prev) =>
      prev.map((t) => {
        if (t.id === txId) {
          const updated = revertTransactionClassification(t);
          if (selectedTxForAudit?.id === txId) {
            setSelectedTxForAudit(updated);
          }
          return updated;
        }
        return t;
      })
    );
  };

  // Resolve an anomaly
  const handleResolveAnomaly = (txId: string, anomalyId: string) => {
    setRawTransactions((prev) =>
      prev.map((t) => {
        if (t.id === txId) {
          return {
            ...t,
            anomalies: t.anomalies.filter((a) => a.id !== anomalyId),
          };
        }
        return t;
      })
    );
  };

  // Resolve a stale account (re-authenticate feed)
  const handleResolveStaleAccount = (accountId: string) => {
    setRawAccounts((prev) =>
      prev.map((a) => {
        if (a.id === accountId) {
          return {
            ...a,
            isStale: false,
            status: 'active',
            staleReason: undefined,
            lastSyncedAt: new Date().toISOString(),
          };
        }
        return a;
      })
    );
  };

  // Rigorous Idempotent Ingestion Pipeline
  const handleIngestData = (
    newAccounts: Account[],
    newTransactions: Transaction[],
    rawPayloadString?: string,
    format: 'plaid_json' | 'plaid_csv' = 'plaid_json',
    replaceExisting: boolean = false,
    customBusinessName?: string
  ): ReconciliationReport => {
    const payloadStr =
      rawPayloadString || JSON.stringify({ accounts: newAccounts, transactions: newTransactions });
    const rawBatch = rawIngestionStore.archivePayload(
      payloadStr,
      format,
      replaceExisting ? 'Plaid User Import (Full Replacement)' : 'Plaid User Import',
      newTransactions.length
    );

    if (replaceExisting) {
      // Complete replacement of existing ledger with newly imported accounts and transactions
      const targetAccounts = newAccounts.length > 0 ? newAccounts : [
        {
          id: 'acc_user_imported',
          name: 'Primary Business Checking',
          officialName: 'Primary Business Checking (Imported)',
          institution: 'Bank',
          mask: '••••',
          type: 'depository',
          subtype: 'checking',
          currentBalance: 0,
          availableBalance: 0,
          currency: 'USD',
          lastSyncedAt: new Date().toISOString(),
          isStale: false,
          isBusiness: true,
          status: 'active',
        } as Account
      ];

      // Reconcile against empty state to produce clean new report
      const { reconciledAccounts, reconciledTransactions, report } = reconcileFinancialState(
        [],
        [],
        {
          incomingAccounts: targetAccounts,
          incomingTransactions: newTransactions,
          rawBatchId: rawBatch.id,
        }
      );

      setRawAccounts(reconciledAccounts);
      setRawTransactions(reconciledTransactions);
      setLatestReconciliationReport(report);
      setLastSyncTime(new Date().toISOString());
      if (customBusinessName) {
        setBusinessName(customBusinessName);
      }

      return report;
    }

    // Reconcile incoming against current state
    const { reconciledAccounts, reconciledTransactions, report } = reconcileFinancialState(
      rawAccounts,
      rawTransactions,
      {
        incomingAccounts: newAccounts.length > 0 ? newAccounts : rawAccounts,
        incomingTransactions: newTransactions,
        rawBatchId: rawBatch.id,
      }
    );

    setRawAccounts(reconciledAccounts);
    setRawTransactions(reconciledTransactions);
    setLatestReconciliationReport(report);
    setLastSyncTime(new Date().toISOString());

    return report;
  };

  // Update account balance, limit, name, etc.
  const handleUpdateAccount = (accountId: string, updates: Partial<Account>) => {
    setRawAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === accountId) {
          return { ...acc, ...updates };
        }
        return acc;
      })
    );
  };

  // Delete an individual transaction
  const handleDeleteTransaction = (txId: string) => {
    setRawTransactions((prev) => prev.filter((tx) => tx.id !== txId));
  };

  // Bulk classify all transactions currently in needs_review
  const handleBulkClassify = (
    targetClassification: TransactionClassification = 'personal',
    reason?: string
  ) => {
    const timestamp = new Date().toISOString();
    const reasonText =
      reason?.trim() ||
      `Batch classified as ${targetClassification === 'personal' ? 'Personal Draw' : targetClassification} per owner directive (all remaining unreviewed items).`;

    setRawTransactions((prev) =>
      prev.map((tx) => {
        if (tx.classification === 'needs_review') {
          const prior = tx.classification;
          return {
            ...tx,
            classification: targetClassification,
            entity: targetClassification === 'personal' ? 'personal' : (targetClassification === 'business' ? 'business' : tx.entity),
            userOverridden: true,
            anomalies: (tx.anomalies || []).filter((a) => a.type !== 'classification_anomaly'),
            auditTrail: [
              {
                id: `aud_bulk_${Date.now()}_${tx.id}`,
                timestamp,
                assignedClassification: targetClassification,
                ruleApplied: 'Owner Batch Reclassification (Non-Business)',
                confidence: 1.0,
                reasoning: reasonText,
                userOverridden: true,
                priorClassification: prior,
                previousValue: prior,
                newValue: targetClassification,
                actor: 'owner_manual',
                canRevert: true,
              },
              ...tx.auditTrail,
            ],
          };
        }
        return tx;
      })
    );
  };

  const DEMO_ACCOUNT_IDS = useMemo(
    () =>
      new Set([
        'acc_mercury_op',
        'acc_amex_plat',
        'acc_chase_tax',
        'acc_sba_loan',
        'acc_capone_spark',
        'acc_chase_pers',
        'acc_mercury_growth',
        'acc_brex_card',
        'acc_chase_biz_high',
        'acc_dep_main',
      ]),
    []
  );

  // Add an individual account
  const handleAddAccount = (account: Account) => {
    setRawAccounts((prev) => [...prev, account]);
  };

  // Delete an individual account
  const handleDeleteAccount = (accountId: string) => {
    setRawAccounts((prev) => prev.filter((a) => a.id !== accountId));
    setRawTransactions((prev) => prev.filter((t) => t.accountId !== accountId));
  };

  // Purge all demo template accounts (Mercury, SBA loan, Amex Plat, etc.)
  const handlePurgeAllDemoAccounts = () => {
    setRawAccounts((prev) => prev.filter((a) => !DEMO_ACCOUNT_IDS.has(a.id)));
    setRawTransactions((prev) => prev.filter((t) => !DEMO_ACCOUNT_IDS.has(t.accountId)));
  };

  // Subscription management
  const handleUpdateSubscription = (subId: string, updates: Partial<Subscription>) => {
    if (customSubscriptions.some((s) => s.id === subId)) {
      setCustomSubscriptions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, ...updates, userOverridden: true } : s))
      );
    } else {
      setSubOverrides((prev) => ({
        ...prev,
        [subId]: { ...(prev[subId] || {}), ...updates, userOverridden: true },
      }));
    }
  };

  const handleDeleteSubscription = (subId: string) => {
    setCustomSubscriptions((prev) => prev.filter((s) => s.id !== subId));
    setDeletedSubIds((prev) => [...prev, subId]);
  };

  const handleAddSubscription = (newSub: Subscription) => {
    setCustomSubscriptions((prev) => [...prev, newSub]);
  };

  // Purge demo artifact transactions (Gary Danko, Vercel demo)
  const handlePurgeDemoArtifacts = () => {
    setRawTransactions((prev) =>
      prev.filter((tx) => {
        const desc = `${tx.rawDescription} ${tx.merchantName} ${tx.cleanMerchant}`.toLowerCase();
        return (
          !desc.includes('gary danko') &&
          !desc.includes('vercel') &&
          !tx.id.includes('gary_danko') &&
          !tx.id.includes('vercel') &&
          !tx.id.includes('settled_dining_02')
        );
      })
    );
  };

  // Clean sync: updates timestamps without injecting fake demo transactions
  const handleSyncNow = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const now = new Date();
      const prevSyncTime = lastSyncTime;
      const newSyncTime = now.toISOString();

      // Refresh accounts lastUpdated
      const updatedAccounts = rawAccounts.map((acc) => ({
        ...acc,
        lastUpdated: newSyncTime,
        isStale: false,
      }));

      setRawAccounts(updatedAccounts);
      setLastSyncTime(newSyncTime);

      const diff = computeSyncDiff(
        rawTransactions,
        rawTransactions,
        rawAccounts,
        updatedAccounts,
        prevSyncTime
      );
      setLatestDiff(diff);
      setIsSyncing(false);
    }, 500);
  };

  // Note handlers
  const handleAddNote = (newNote: FinancialNote) => {
    setNotes((prev) => [newNote, ...prev]);
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  // Purge all demo fixtures completely from production state and localStorage (Requirement 1 & 2)
  // Purge all fixtures completely from production state, localStorage, and shared backend ledger
  const handlePurgeAllFixtures = () => {
    localStorage.removeItem(STORAGE_KEY_ACCOUNTS);
    localStorage.removeItem(STORAGE_KEY_TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEY_RECON);
    localStorage.removeItem('tasklet_sub_overrides_v2');
    localStorage.removeItem('tasklet_custom_subs_v2');
    localStorage.removeItem('tasklet_deleted_subs_v2');
    localStorage.removeItem(STORAGE_KEY_NOTES);
    localStorage.removeItem(STORAGE_KEY_DATA_MODE);
    rawIngestionStore.clear();

    setRawAccounts([]);
    setRawTransactions([]);
    setSubOverrides({});
    setCustomSubscriptions([]);
    setDeletedSubIds([]);
    setNotes([]);
    setBusinessName('My Business');
    setDataMode('unknown_freshness');
    setLatestDiff(null);
    setLatestReconciliationReport(null);
    setSelectedMetricLineage(null);

    // Sync reset immediately to server
    fetch('/api/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exists: true,
        rawAccounts: [],
        rawTransactions: [],
        thresholds: DEFAULT_THRESHOLDS,
        lastSyncTime: null,
        businessName: 'My Business',
        dataMode: 'unknown_freshness',
        notes: [],
        subOverrides: {},
        customSubscriptions: [],
        deletedSubIds: [],
        latestReconciliationReport: null,
        updatedAt: new Date().toISOString(),
      }),
    }).catch(() => {});
  };

  // Commit reconciled import strictly partitioned by record_type (Requirement 4 & 7)
  const handleCommitRecordTypeImport = (
    summary: ImportReconciliationSummary,
    mode: 'replace' | 'append',
    customBusinessName?: string
  ) => {
    const incomingAccounts = [...summary.parsedAccounts, ...summary.parsedLoans];

    if (mode === 'replace') {
      setRawAccounts(incomingAccounts);
      setRawTransactions(summary.parsedTransactions);
      setCustomSubscriptions(summary.parsedBills);
      setNotes(summary.parsedNotes);
      setSubOverrides({});
      setDeletedSubIds([]);
    } else {
      setRawAccounts((prev) => {
        const updated = [...prev];
        incomingAccounts.forEach((acc) => {
          const matchIndex = updated.findIndex((existing) => {
            if (existing.id === acc.id) return true;
            if (acc.mask && acc.mask !== '••••' && existing.mask && existing.mask !== '••••' && existing.mask === acc.mask) return true;
            if (acc.mask && acc.mask !== '••••' && (existing.name.includes(acc.mask) || existing.id.includes(acc.mask))) return true;
            const cleanAcc = acc.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanExist = existing.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanAcc.length > 5 && (cleanExist.includes(cleanAcc) || cleanAcc.includes(cleanExist))) return true;
            return false;
          });

          if (matchIndex >= 0) {
            updated[matchIndex] = {
              ...updated[matchIndex],
              name: acc.name.length > updated[matchIndex].name.length ? acc.name : updated[matchIndex].name,
              currentBalance: acc.currentBalance,
              availableBalance: acc.availableBalance,
              creditLimit: acc.creditLimit !== undefined ? acc.creditLimit : updated[matchIndex].creditLimit,
              interestRate: acc.interestRate !== undefined ? acc.interestRate : updated[matchIndex].interestRate,
              monthlyPayment: acc.monthlyPayment !== undefined ? acc.monthlyPayment : updated[matchIndex].monthlyPayment,
              mask: acc.mask && acc.mask !== '••••' ? acc.mask : updated[matchIndex].mask,
              status: acc.status || updated[matchIndex].status,
              lastSyncedAt: acc.lastSyncedAt,
            };
          } else {
            updated.push(acc);
          }
        });
        return updated;
      });
      setRawTransactions((prev) => {
        const existingMap = new Map(prev.map((t) => [t.sourceTxId || t.id, t]));
        const updated = [...prev];
        summary.parsedTransactions.forEach((newTx) => {
          const key = newTx.sourceTxId || newTx.id;
          const existing = existingMap.get(key);
          if (existing) {
            const idx = updated.findIndex((t) => (t.sourceTxId || t.id) === key);
            if (idx >= 0) updated[idx] = { ...existing, ...newTx };
          } else {
            updated.push(newTx);
          }
        });
        return updated;
      });
      setCustomSubscriptions((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const fresh = summary.parsedBills.filter((s) => !existingIds.has(s.id));
        return [...prev, ...fresh];
      });
      setNotes((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const fresh = summary.parsedNotes.filter((n) => !existingIds.has(n.id));
        return [...prev, ...fresh];
      });
    }

    if (customBusinessName && customBusinessName.trim()) {
      setBusinessName(customBusinessName.trim());
    }
    setDataMode('imported_csv');
    setLastSyncTime(new Date().toISOString());
  };

  // Export verifiable audit package tracing all dashboard metrics to source records (Requirement 10)
  const handleExportAuditPackage = (format: 'json' | 'csv') => {
    const manifest = buildFinancialExportManifest({
      businessName,
      dataMode,
      accounts: processedAccounts,
      transactions: processedTransactions,
      subscriptions,
      notes,
      briefing,
      monthlyBurnRate,
    });
    if (format === 'json') {
      exportTraceableJson(manifest);
    } else {
      exportTraceableCsv(manifest);
    }
  };

  // Clear data completely (aliases handlePurgeAllFixtures)
  const handleClearData = () => {
    handlePurgeAllFixtures();
  };

  // Reset data completely to clean slate
  const handleResetData = () => {
    handlePurgeAllFixtures();
  };

  return (
    <FinancialContext.Provider
      value={{
        accounts: processedAccounts,
        transactions: processedTransactions,
        subscriptions,
        monthlyBurnRate,
        annualBurnRate,
        briefing,
        latestDiff,
        latestReconciliationReport,
        dataHealth,
        thresholds,
        filters,
        setFilters,
        setThresholds,
        businessName,
        setBusinessName,
        isDemoData,
        dataMode,
        setDataMode,
        notes,
        handleAddNote,
        handleDeleteNote,
        handlePurgeAllFixtures,
        handleCommitRecordTypeImport,
        handleExportAuditPackage,
        isDataValid,
        activeEntity,
        setActiveEntity,
        handleReclassify,
        handleClassifySelected,
        handleRevertClassification,
        handleSyncNow,
        handleResolveStaleAccount,
        handleResolveAnomaly,
        handleIngestData,
        handleResetData,
        handleClearData,
        handleUpdateAccount,
        handleAddAccount,
        handleDeleteAccount,
        handlePurgeAllDemoAccounts,
        handleDeleteTransaction,
        handleBulkClassify,
        handlePurgeDemoArtifacts,
        handleUpdateSubscription,
        handleDeleteSubscription,
        handleAddSubscription,
        selectedTxForAudit,
        setSelectedTxForAudit,
        selectedMetricLineage,
        handleInspectMetric,
        clearMetricLineage,
        isSyncing,
        lastSyncTime,
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
};

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial must be used within a FinancialProvider');
  }
  return context;
};
