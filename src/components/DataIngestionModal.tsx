import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  UploadCloud,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Database,
  ArrowRight,
  Trash2,
  Code2,
  Building2,
  DollarSign,
  Wallet,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { parsePlaidJson, parsePlaidCsv } from '../services/plaidParser';
import {
  parseRecordTypeContent,
  generateSampleRecordTypeCsv,
} from '../services/recordTypeParser';
import { ImportReconciliationModal } from './ImportReconciliationModal';
import { Account, ImportReconciliationSummary, Transaction } from '../types';
import { formatCurrency } from '../services/normalization';

interface DataIngestionModalProps {
  onClose: () => void;
}

interface EditableDiscoveredAccount {
  id: string;
  name: string;
  institution: string;
  type: 'depository' | 'credit' | 'loan';
  subtype: 'checking' | 'credit_card' | 'term_loan';
  balance: number;
  creditLimit?: number;
  txCount: number;
}

export const DataIngestionModal: React.FC<DataIngestionModalProps> = ({ onClose }) => {
  const {
    accounts,
    transactions,
    handleIngestData,
    handleCommitRecordTypeImport,
    businessName,
    setBusinessName,
    isDemoData,
  } = useFinancial();

  const [reconciliationSummary, setReconciliationSummary] = useState<ImportReconciliationSummary | null>(null);
  const [activeMode, setActiveMode] = useState<'upload' | 'preset' | 'export'>('upload');
  const [fileFormat, setFileFormat] = useState<'json' | 'csv'>('csv');
  const [pasteContent, setPasteContent] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showManualPaste, setShowManualPaste] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    type: 'CSV' | 'JSON';
  } | null>(null);

  // Replacement vs Append mode (defaults to replace if demo data is currently loaded)
  const [replaceExisting, setReplaceExisting] = useState<boolean>(isDemoData || accounts.length === 0);
  const [companyNameInput, setCompanyNameInput] = useState<string>(
    isDemoData ? 'My Business' : businessName
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [previewTransactions, setPreviewTransactions] = useState<Transaction[]>([]);
  const [editableAccounts, setEditableAccounts] = useState<EditableDiscoveredAccount[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync default replaceExisting when isDemoData changes
  useEffect(() => {
    if (isDemoData) {
      setReplaceExisting(true);
      setCompanyNameInput('My Business');
    }
  }, [isDemoData]);

  // Parse raw text or file content
  const parseContent = (content: string, format: 'json' | 'csv', fallbackName?: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!content.trim()) {
        throw new Error('Content is empty.');
      }

      // Universal Ingestion Engine: parses any CSV or JSON into strict tables & produces staging report
      const summary = parseRecordTypeContent(content, {
        existingTransactionIds: new Set(transactions.map((t) => t.sourceTxId || t.id)),
        existingAccounts: accounts,
        fileName: uploadedFile?.name || (format === 'json' ? 'statement_export.json' : 'bank_statement.csv'),
        fileSize: uploadedFile?.size,
        defaultAccountName: fallbackName || 'Primary Business Checking',
      });

      if (
        summary.acceptedCount === 0 &&
        summary.rejectedCount === 0 &&
        summary.duplicatesSkippedCount === 0 &&
        summary.unknownRecordTypesCount === 0
      ) {
        throw new Error('No valid financial records detected in file.');
      }

      // Open the Read-Only Staging Screen with Reconciliation Report!
      setReconciliationSummary(summary);
    } catch (err: any) {
      setReconciliationSummary(null);
      setErrorMsg(err.message || 'Failed to parse file content.');
    }
  };

  // Process selected or dropped File object
  const processFile = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');
    const isJson = file.name.toLowerCase().endsWith('.json') || file.type.includes('json');

    if (!isCsv && !isJson) {
      setErrorMsg('Please upload a valid .csv or .json file.');
      return;
    }

    const detectedFormat: 'csv' | 'json' = isCsv ? 'csv' : 'json';
    setFileFormat(detectedFormat);
    setUploadedFile({
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: isCsv ? 'CSV' : 'JSON',
    });

    // Invert account name from file name if helpful (e.g. chase_checking.csv -> Chase Checking)
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const suggestedAccountName =
      baseName.length > 3
        ? baseName.charAt(0).toUpperCase() + baseName.slice(1)
        : 'Primary Business Checking';

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content || !content.trim()) {
        setErrorMsg('The selected file is empty.');
        return;
      }
      setPasteContent(content);
      parseContent(content, detectedFormat, suggestedAccountName);
    };
    reader.onerror = () => {
      setErrorMsg('Error reading file from disk.');
    };
    reader.readAsText(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleClearFile = () => {
    setUploadedFile(null);
    setPasteContent('');
    setPreviewTransactions([]);
    setEditableAccounts([]);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Update account fields in preview
  const handleUpdateAccountBalance = (accId: string, newBalance: number) => {
    setEditableAccounts((prev) =>
      prev.map((a) => (a.id === accId ? { ...a, balance: newBalance } : a))
    );
  };

  const handleUpdateAccountType = (accId: string, newType: 'depository' | 'credit' | 'loan') => {
    setEditableAccounts((prev) =>
      prev.map((a) => {
        if (a.id === accId) {
          const subtype =
            newType === 'credit' ? 'credit_card' : newType === 'loan' ? 'term_loan' : 'checking';
          return {
            ...a,
            type: newType,
            subtype,
            creditLimit: newType === 'credit' ? a.creditLimit || 25000 : undefined,
          };
        }
        return a;
      })
    );
  };

  const handleUpdateAccountName = (accId: string, newName: string) => {
    setEditableAccounts((prev) =>
      prev.map((a) => (a.id === accId ? { ...a, name: newName } : a))
    );
  };

  // Commit ingestion with user's configured accounts and balances
  const handleCommitIngest = () => {
    if (previewTransactions.length === 0) return;

    // Convert editable accounts to real Account objects
    const finalAccounts: Account[] = editableAccounts.map((ea) => ({
      id: ea.id,
      name: ea.name,
      officialName: `${ea.name} (Imported)`,
      institution: ea.institution,
      mask: '••••',
      type: ea.type,
      subtype: ea.subtype,
      currentBalance: ea.balance,
      availableBalance: ea.type === 'depository' ? ea.balance : ea.balance,
      creditLimit: ea.creditLimit,
      currency: 'USD',
      lastSyncedAt: new Date().toISOString(),
      isStale: false,
      isBusiness: true,
      status: 'active',
    }));

    // Update transactions to map to new account IDs if needed
    const finalTransactions = previewTransactions.map((tx) => {
      const matched = finalAccounts.find(
        (a) => a.id === tx.accountId || a.name.toLowerCase() === tx.accountName.toLowerCase()
      );
      if (matched) {
        return {
          ...tx,
          accountId: matched.id,
          accountName: matched.name,
          institution: matched.institution,
        };
      }
      return {
        ...tx,
        accountId: finalAccounts[0]?.id || tx.accountId,
        accountName: finalAccounts[0]?.name || tx.accountName,
        institution: finalAccounts[0]?.institution || tx.institution,
      };
    });

    const report = handleIngestData(
      finalAccounts,
      finalTransactions,
      pasteContent,
      fileFormat === 'csv' ? 'plaid_csv' : 'plaid_json',
      replaceExisting,
      companyNameInput.trim() || 'My Business'
    );

    setSuccessMsg(
      `Reconciliation complete: ${report.newTransactions.length} transactions and ${finalAccounts.length} accounts loaded! Dashboard updated.`
    );
    setTimeout(() => onClose(), 1000);
  };

  // Preset scenarios
  const loadPreset = (presetType: 'tech_startup' | 'high_utilization') => {
    setErrorMsg(null);
    if (presetType === 'tech_startup') {
      const presetAccounts: Account[] = [
        {
          id: 'acc_mercury_growth',
          name: 'Mercury Operating',
          officialName: 'Mercury Treasury Tier 1 ••8812',
          institution: 'Mercury',
          mask: '8812',
          type: 'depository',
          subtype: 'checking',
          currentBalance: 145000,
          availableBalance: 139200,
          currency: 'USD',
          lastSyncedAt: new Date().toISOString(),
          isStale: false,
          isBusiness: true,
          status: 'active',
        },
        {
          id: 'acc_brex_card',
          name: 'Brex Corporate Card',
          officialName: 'Brex Commercial World Elite ••4491',
          institution: 'Brex',
          mask: '4491',
          type: 'credit',
          subtype: 'credit_card',
          currentBalance: 18450,
          availableBalance: 31550,
          creditLimit: 50000,
          currency: 'USD',
          lastSyncedAt: new Date().toISOString(),
          isStale: false,
          isBusiness: true,
          status: 'active',
        },
      ];

      const presetTxs: Transaction[] = [
        {
          id: 'tx_pst_01',
          accountId: 'acc_brex_card',
          accountName: 'Brex Corporate Card',
          institution: 'Brex',
          date: '2026-10-02',
          rawDescription: 'AMAZON WEB SERVICES EC2 S3 PROD',
          merchantName: 'Amazon Web Services',
          cleanMerchant: 'Amazon Web Services',
          amount: 2840.0,
          currency: 'USD',
          pending: false,
          category: ['Cloud Infrastructure'],
          classification: 'business',
          auditTrail: [
            {
              id: 'aud_pst_1',
              timestamp: new Date().toISOString(),
              assignedClassification: 'business',
              ruleApplied: 'Cloud Infrastructure Rule',
              confidence: 0.99,
              reasoning: 'Server hosting for production application.',
              userOverridden: false,
            },
          ],
          anomalies: [],
        },
        {
          id: 'tx_pst_02',
          accountId: 'acc_mercury_growth',
          accountName: 'Mercury Operating',
          institution: 'Mercury',
          date: '2026-10-01',
          rawDescription: 'STRIPE PAYOUT BATCH #9812',
          merchantName: 'Stripe Payments',
          cleanMerchant: 'Stripe Payments',
          amount: -45200.0,
          currency: 'USD',
          pending: false,
          category: ['Deposit'],
          classification: 'income',
          auditTrail: [
            {
              id: 'aud_pst_2',
              timestamp: new Date().toISOString(),
              assignedClassification: 'income',
              ruleApplied: 'Stripe Payout Rule',
              confidence: 0.99,
              reasoning: 'Customer subscription recurring revenue.',
              userOverridden: false,
            },
          ],
          anomalies: [],
        },
      ];

      handleIngestData(presetAccounts, presetTxs, undefined, 'plaid_json', true, 'Nova Dynamics Inc');
      setSuccessMsg('High-Growth Startup dataset loaded successfully!');
    } else {
      const presetAccounts: Account[] = [
        {
          id: 'acc_chase_biz_high',
          name: 'Chase Ink Business Cash',
          officialName: 'Chase Ink Commercial ••2291',
          institution: 'Chase',
          mask: '2291',
          type: 'credit',
          subtype: 'credit_card',
          currentBalance: 18200,
          availableBalance: 1800,
          creditLimit: 20000,
          interestRate: 26.99,
          currency: 'USD',
          lastSyncedAt: new Date().toISOString(),
          isStale: false,
          isBusiness: true,
          status: 'active',
        },
        {
          id: 'acc_dep_main',
          name: 'Main Business Checking',
          officialName: 'Chase Total Business Checking ••1102',
          institution: 'Chase',
          mask: '1102',
          type: 'depository',
          subtype: 'checking',
          currentBalance: 8400,
          availableBalance: 8400,
          currency: 'USD',
          lastSyncedAt: new Date().toISOString(),
          isStale: false,
          isBusiness: true,
          status: 'active',
        },
      ];

      const presetTxs: Transaction[] = [
        {
          id: 'tx_util_01',
          accountId: 'acc_chase_biz_high',
          accountName: 'Chase Ink Business Cash',
          institution: 'Chase',
          date: '2026-10-02',
          rawDescription: 'INVENTORY SUPPLIES WHOLESALE',
          merchantName: 'Wholesale Depot',
          cleanMerchant: 'Wholesale Depot',
          amount: 4200.0,
          currency: 'USD',
          pending: false,
          category: ['Supplies'],
          classification: 'business',
          auditTrail: [
            {
              id: 'aud_u1',
              timestamp: new Date().toISOString(),
              assignedClassification: 'business',
              ruleApplied: 'Business Account Default Bias',
              confidence: 0.85,
              reasoning: 'Commercial inventory purchase.',
              userOverridden: false,
            },
          ],
          anomalies: [],
        },
      ];

      handleIngestData(presetAccounts, presetTxs, undefined, 'plaid_json', true, 'Peak Wholesale Retailers');
      setSuccessMsg('High-Utilization scenario loaded successfully!');
    }
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const sampleCsv = `Transaction ID,Account Name,Date,Description,Amount,Category,Pending
tx_sample_01,Mercury Operating,2026-10-02,AWS EC2 & S3 CLOUD HOSTING,2840.00,Cloud Infrastructure,false
tx_sample_02,Mercury Operating,2026-10-01,STRIPE PAYOUT BATCH #8491,-32500.00,Deposit,false
tx_sample_03,Mercury Operating,2026-09-30,TRANSFER TO CHASE INK CARD,-5000.00,Transfer,false
tx_sample_04,Chase Ink Business Cash,2026-09-30,PAYMENT THANK YOU - AUTOPAY,5000.00,Credit Card Payment,false
tx_sample_05,Chase Ink Business Cash,2026-10-02,APPLE STORE SOHO HARDWARE,1499.00,Equipment,false
tx_sample_06,Chase Ink Business Cash,2026-10-03,UBER TRIP PENDING,42.50,Travel,true`;

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plaid_sample_export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export current dataset to JSON
  const handleExportJson = () => {
    const payload = {
      businessName,
      accounts,
      transactions,
      exportedAt: new Date().toISOString(),
      source: 'Tasklet Financial Command Center',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tasklet_Export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export current dataset to Portable Unified CSV
  const handleExportCsv = () => {
    const headers = [
      'Transaction ID',
      'Date',
      'Merchant',
      'Original Description',
      'Amount',
      'Status',
      'Account Name',
      'Institution',
      'Classification',
      'Categories',
      'Audit Reasoning',
    ];

    const rows = transactions.map((tx) => [
      `"${tx.id}"`,
      `"${tx.date}"`,
      `"${(tx.cleanMerchant || tx.merchantName || '').replace(/"/g, '""')}"`,
      `"${(tx.rawDescription || '').replace(/"/g, '""')}"`,
      tx.amount,
      `"${tx.pending ? 'Pending Hold' : 'Posted'}"`,
      `"${(tx.accountName || '').replace(/"/g, '""')}"`,
      `"${(tx.institution || '').replace(/"/g, '""')}"`,
      `"${tx.classification}"`,
      `"${(tx.category || []).join('; ')}"`,
      `"${((tx.auditTrail && tx.auditTrail[0]?.reasoning) || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tasklet_Unified_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Multi-Record CSV Template (Requirement 4)
  const handleDownloadMultiRecordCsv = () => {
    const sampleCsv = generateSampleRecordTypeCsv();
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tasklet_Multi_Record_Type_Template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Load and test multi-record type sample directly
  const handleTestMultiRecordSample = () => {
    const sampleCsv = generateSampleRecordTypeCsv();
    const summary = parseRecordTypeContent(sampleCsv, {
      existingTransactionIds: new Set(transactions.map((t) => t.id)),
    });
    setReconciliationSummary(summary);
  };

  if (reconciliationSummary) {
    return (
      <ImportReconciliationModal
        summary={reconciliationSummary}
        initialCompanyName={companyNameInput}
        onConfirm={(mode, compName) => {
          handleCommitRecordTypeImport(reconciliationSummary, mode, compName);
          setReconciliationSummary(null);
          onClose();
        }}
        onClose={() => setReconciliationSummary(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Plaid & Bank CSV Ingestion
              </h2>
              <span className="text-xs text-slate-400">
                Import statements, discover accounts, set balances, and recalculate metrics
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

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2 gap-4 text-xs">
          <button
            onClick={() => setActiveMode('upload')}
            className={`pb-2.5 font-medium border-b-2 transition cursor-pointer ${
              activeMode === 'upload'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Upload Bank / Plaid File
          </button>
          <button
            onClick={() => setActiveMode('preset')}
            className={`pb-2.5 font-medium border-b-2 transition cursor-pointer ${
              activeMode === 'preset'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Preset Scenarios
          </button>
          <button
            onClick={() => setActiveMode('export')}
            className={`pb-2.5 font-medium border-b-2 transition cursor-pointer ${
              activeMode === 'export'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Export Active Dataset
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeMode === 'upload' && (
            <div className="space-y-4 text-xs">
              {/* Data Ingestion Target Settings */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-slate-300 font-medium">Business / Entity Name:</span>
                  </div>
                  <input
                    type="text"
                    value={companyNameInput}
                    onChange={(e) => setCompanyNameInput(e.target.value)}
                    placeholder="e.g. My Business LLC"
                    className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 max-w-xs w-full"
                  />
                </div>

                {/* Replace vs Append Mode Selection */}
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 font-medium block mb-1.5">Ingestion Mode:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start space-x-2 ${
                        replaceExisting
                          ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-200'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="replace_mode"
                        checked={replaceExisting}
                        onChange={() => setReplaceExisting(true)}
                        className="mt-0.5 text-emerald-600 focus:ring-0"
                      />
                      <div>
                        <div className="font-semibold text-slate-200">
                          Replace Demo / Mock Data <span className="text-[10px] text-emerald-400 font-mono">(Recommended)</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Wipes fake Acme Labs numbers ($111k cash, $118k loan) and replaces the dashboard with your statement.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start space-x-2 ${
                        !replaceExisting
                          ? 'border-indigo-500/60 bg-indigo-950/30 text-indigo-200'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="replace_mode"
                        checked={!replaceExisting}
                        onChange={() => setReplaceExisting(false)}
                        className="mt-0.5 text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <div className="font-semibold text-slate-200">
                          Merge into Existing Ledger
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Appends newly parsed transactions into currently loaded accounts without clearing existing records.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center space-y-3 ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                    : uploadedFile
                    ? 'border-emerald-500/40 bg-emerald-950/20'
                    : 'border-slate-700/80 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-950/70'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.json,text/csv,application/json"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {uploadedFile ? (
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                      {uploadedFile.type === 'CSV' ? (
                        <FileSpreadsheet className="w-6 h-6" />
                      ) : (
                        <FileCode className="w-6 h-6" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                        <span>{uploadedFile.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          {uploadedFile.type}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{uploadedFile.size} • Click to choose another file</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        Drop your bank <span className="text-indigo-400 font-bold">CSV</span> or Plaid export here
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        or <span className="text-indigo-400 underline underline-offset-2">browse files</span> from your computer
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Supports Chase, Mercury, Brex, Bank of America, Wells Fargo, Stripe, and Plaid formats
                    </span>
                  </>
                )}
              </div>

              {/* Utility actions: Sample template + Manual text toggle */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadMultiRecordCsv}
                    className="text-cyan-400 hover:text-cyan-300 inline-flex items-center space-x-1 cursor-pointer transition font-medium"
                    title="Download template with record_type columns (transaction, account_snapshot, bill, loan, notes)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Multi-Record CSV Template</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestMultiRecordSample}
                    className="text-emerald-400 hover:text-emerald-300 inline-flex items-center space-x-1 cursor-pointer transition font-medium"
                    title="Preview multi-record-type sample in reconciliation screen"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Test Reconciliation Screen</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="text-slate-400 hover:text-slate-300 inline-flex items-center space-x-1 cursor-pointer transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Sample Bank CSV</span>
                  </button>

                  {uploadedFile && (
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="text-rose-400 hover:text-rose-300 inline-flex items-center space-x-1 cursor-pointer transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove File</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowManualPaste(!showManualPaste)}
                  className="text-slate-400 hover:text-slate-200 inline-flex items-center space-x-1 cursor-pointer transition"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showManualPaste ? 'Hide Raw Text Editor' : 'Paste Raw Text Instead'}</span>
                </button>
              </div>

              {/* Collapsible Manual Raw Paste Area */}
              {showManualPaste && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-400 text-xs">
                      Paste {fileFormat.toUpperCase()} raw string:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (fileFormat === 'json') {
                          const demoJson = JSON.stringify(
                            {
                              accounts: [
                                {
                                  account_id: 'acc_demo_svb',
                                  name: 'Mercury Tech Operating',
                                  type: 'depository',
                                  subtype: 'checking',
                                  balances: { current: 75400, available: 74200 },
                                },
                              ],
                              transactions: [
                                {
                                  transaction_id: 'tx_demo_01',
                                  account_id: 'acc_demo_svb',
                                  name: 'GOOGLE *WORKSPACE',
                                  amount: 144.0,
                                  date: '2026-10-02',
                                  pending: false,
                                },
                                {
                                  transaction_id: 'tx_demo_02',
                                  account_id: 'acc_demo_svb',
                                  name: 'STRIPE PAYOUT',
                                  amount: -8400.0,
                                  date: '2026-10-01',
                                  pending: false,
                                },
                              ],
                            },
                            null,
                            2
                          );
                          setPasteContent(demoJson);
                          parseContent(demoJson, 'json');
                        } else {
                          const demoCsv = `Transaction ID,Account Name,Date,Description,Amount,Category,Pending\ntx_demo_1,Mercury Operating,2026-10-02,GITHUB SUBSCRIPTION,210.00,Software,false\ntx_demo_2,Mercury Operating,2026-10-01,STRIPE PAYOUT,-14500.00,Income,false`;
                          setPasteContent(demoCsv);
                          parseContent(demoCsv, 'csv');
                        }
                      }}
                      className="text-xs text-indigo-400 hover:underline cursor-pointer"
                    >
                      Insert Sample Snippet
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={pasteContent}
                    onChange={(e) => {
                      setPasteContent(e.target.value);
                      if (e.target.value.trim()) {
                        parseContent(e.target.value, fileFormat);
                      } else {
                        setEditableAccounts([]);
                        setPreviewTransactions([]);
                      }
                    }}
                    placeholder={
                      fileFormat === 'json'
                        ? '{\n  "accounts": [...],\n  "transactions": [...]\n}'
                        : 'Transaction ID,Account Name,Date,Description,Amount,Category,Pending\ntx_101,Mercury Operating,2026-10-02,AWS SERVICES,450.00,Software,false'
                    }
                    className="w-full p-2.5 font-mono text-[11px] bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Discovered Accounts & Balances Configuration Card */}
              {editableAccounts.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950/95 border border-indigo-500/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold text-slate-200">
                        Discovered Accounts & Starting Balances
                      </span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {previewTransactions.length} transactions in statement
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Confirm or edit your account balance below. The dashboard will use these exact figures to calculate True Available Cash and Debt:
                  </p>

                  <div className="space-y-3">
                    {editableAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <input
                            type="text"
                            value={acc.name}
                            onChange={(e) => handleUpdateAccountName(acc.id, e.target.value)}
                            className="bg-slate-950 border border-slate-700 text-slate-200 font-semibold text-xs rounded px-2 py-1 focus:outline-none focus:border-indigo-500 flex-1 max-w-sm"
                          />
                          <div className="flex items-center space-x-2">
                            <select
                              value={acc.type}
                              onChange={(e) =>
                                handleUpdateAccountType(
                                  acc.id,
                                  e.target.value as 'depository' | 'credit' | 'loan'
                                )
                              }
                              className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1 focus:outline-none"
                            >
                              <option value="depository">Checking / Depository</option>
                              <option value="credit">Credit Card</option>
                              <option value="loan">Term Loan</option>
                            </select>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {acc.txCount} txs
                            </span>
                          </div>
                        </div>

                        {/* Balance and limit inputs */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-800/80">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-slate-400 text-[11px]">
                              {acc.type === 'credit'
                                ? 'Outstanding Balance:'
                                : acc.type === 'loan'
                                ? 'Principal Balance:'
                                : 'Current Balance:'}
                            </span>
                            <div className="relative">
                              <span className="absolute left-2 top-1 text-slate-500 text-xs">$</span>
                              <input
                                type="number"
                                step="any"
                                value={acc.balance}
                                onChange={(e) =>
                                  handleUpdateAccountBalance(
                                    acc.id,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-semibold text-xs rounded pl-5 pr-2 py-1 w-28 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>

                          {acc.type === 'credit' && (
                            <div className="flex items-center space-x-1.5">
                              <span className="text-slate-400 text-[11px]">Credit Limit:</span>
                              <div className="relative">
                                <span className="absolute left-2 top-1 text-slate-500 text-xs">$</span>
                                <input
                                  type="number"
                                  step="any"
                                  value={acc.creditLimit || 25000}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setEditableAccounts((prev) =>
                                      prev.map((a) =>
                                        a.id === acc.id ? { ...a, creditLimit: val } : a
                                      )
                                    );
                                  }}
                                  className="bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs rounded pl-5 pr-2 py-1 w-28 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Transaction snippet preview table */}
                  {previewTransactions.length > 0 && (
                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60">
                      <div className="px-3 py-1.5 bg-slate-950/80 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        First {Math.min(previewTransactions.length, 3)} Transactions Sample
                      </div>
                      <div className="divide-y divide-slate-800/80 text-[11px]">
                        {previewTransactions.slice(0, 3).map((tx) => (
                          <div key={tx.id} className="px-3 py-2 flex items-center justify-between gap-2">
                            <div className="truncate min-w-0">
                              <span className="text-slate-200 font-medium">
                                {tx.cleanMerchant || tx.rawDescription}
                              </span>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                <span>{tx.date}</span>
                                <span>•</span>
                                <span>{tx.accountName}</span>
                                {tx.pending && (
                                  <span className="text-amber-400 font-semibold px-1 rounded bg-amber-500/10">
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div
                                className={`font-mono font-semibold ${
                                  tx.amount < 0 ? 'text-emerald-400' : 'text-slate-200'
                                }`}
                              >
                                {tx.amount < 0 ? '+' : ''}
                                {formatCurrency(Math.abs(tx.amount))}
                              </div>
                              <span className="text-[10px] text-slate-400 capitalize">
                                {tx.classification.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Commit Action Button */}
                  <button
                    onClick={handleCommitIngest}
                    className="w-full py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg shadow-emerald-950/50 text-sm"
                  >
                    <span>Apply to Dashboard & Update All Numbers</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeMode === 'preset' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Choose a pre-configured scenario to test how Tasklet Command Center adapts to different business stages:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 transition space-y-2">
                  <div className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>High-Growth SaaS Startup</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Mercury Treasury checking with $145k cash, Brex Corporate Card, $45k Stripe payouts, and $2.8k AWS cloud bill.
                  </p>
                  <button
                    onClick={() => loadPreset('tech_startup')}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer mt-2"
                  >
                    Load SaaS Scenario
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 transition space-y-2">
                  <div className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>Critical 91% Card Utilization</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Chase Ink Card at $18,200 balance against $20,000 limit (91% utilization), triggering critical danger alerts and paydown plans.
                  </p>
                  <button
                    onClick={() => loadPreset('high_utilization')}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition cursor-pointer mt-2"
                  >
                    Load Critical Util Scenario
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition space-y-2 sm:col-span-2">
                  <div className="font-bold text-xs text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <FileSpreadsheet className="w-4 h-4" />
                      Multi-Record-Type Pipeline (All 5 Types)
                    </span>
                    <button
                      onClick={handleDownloadMultiRecordCsv}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download Template CSV</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Comprehensive ledger batch containing <strong>transaction</strong>, <strong>account_snapshot</strong>, <strong>bill</strong>, <strong>loan</strong>, and <strong>notes_assumptions</strong>. Opens pre-commit reconciliation screen with row metrics and category breakdowns.
                  </p>
                  <button
                    onClick={handleTestMultiRecordSample}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer mt-2 shadow-md shadow-emerald-950/40"
                  >
                    Open Import Reconciliation Screen
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeMode === 'export' && (
            <div className="space-y-4 text-xs">
              <p className="text-slate-300">
                Export your current reconciled financial ledger, account balances, and classification audit trails for accounting, CPA tax preparation, or backup:
              </p>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="text-slate-200 font-medium">Current Ledger Dataset Summary:</div>
                <div className="text-slate-400">
                  {accounts.length} Connected Accounts • {transactions.length} Normalized Transactions with Audit Histories
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Portable Unified CSV</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    A single unified spreadsheet of all current stored records across all your accounts. Compatible with Excel, Google Sheets, QuickBooks, and Xero.
                  </p>
                  <button
                    onClick={handleExportCsv}
                    className="w-full mt-2 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Unified CSV</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-xs text-indigo-400 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4" />
                    <span>Structured JSON Payload</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Full raw JSON dump including immutable raw batch hashes, classification confidence scores, rule IDs, and metadata.
                  </p>
                  <button
                    onClick={handleExportJson}
                    className="w-full mt-2 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JSON Payload</span>
                  </button>
                </div>
              </div>
            </div>
          )}
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
