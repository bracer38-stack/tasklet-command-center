export type DataMode =
  | 'demo'
  | 'imported_csv'
  | 'connected_live'
  | 'stale_disconnected'
  | 'unknown_freshness';

export type RecordType =
  | 'transaction'
  | 'account_snapshot'
  | 'bill'
  | 'loan'
  | 'notes_assumptions';

export type AccountType = 'depository' | 'credit' | 'loan' | 'investment';
export type AccountSubtype = 
  | 'checking' 
  | 'savings' 
  | 'credit_card' 
  | 'term_loan' 
  | 'sba_loan' 
  | 'line_of_credit';

export type FinancialEntity = 'business' | 'personal' | 'household' | 'owner_draw' | 'unknown';

export interface Account {
  id: string;
  name: string;
  officialName: string;
  institution: string; // 'Mercury', 'Chase', 'Amex', 'Capital One', 'Brex', 'SBA'
  mask: string; // '4829'
  type: AccountType;
  subtype: AccountSubtype;
  currentBalance: number; // Book / posted balance
  availableBalance: number | null; // Nullable if institution does not report available
  creditLimit?: number; // Total limit for credit accounts
  isNoPresetLimit?: boolean; // For charge cards (e.g. Amex Platinum/Centurion) with no preset limit
  interestRate?: number; // APR % for loans/cards
  monthlyPayment?: number; // Regular monthly installment for loans
  maturityDate?: string; // Maturity date for term loans
  currency: string;
  lastSyncedAt: string; // ISO 8601 string
  sourceBalanceTimestamp?: string | null; // Exact timestamp from source financial institution
  isStale: boolean; // Flagged if sync > 72 hours ago or broken
  staleReason?: string;
  isBusiness: boolean; // Primary designation
  entity?: FinancialEntity; // Fixed entity separation (business, personal, household, owner_draw)
  status: 'active' | 'sync_error' | 'disconnected';
  color?: string;
}

export type TransactionClassification =
  | 'business'
  | 'personal'
  | 'transfer'
  | 'reimbursement'
  | 'income'
  | 'debt_payment'
  | 'needs_review';

export type AnomalyType =
  | 'duplicate_charge'
  | 'unexpected_merchant'
  | 'unusually_large'
  | 'classification_anomaly'
  | 'stale_feed_impact'
  | 'price_increase'
  | 'reversal';

export interface AnomalyItem {
  id: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  details?: string;
}

export interface AuditTrailEntry {
  id: string;
  timestamp: string;
  assignedClassification: TransactionClassification;
  ruleApplied: string;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  userOverridden: boolean;
  priorClassification?: TransactionClassification;
  previousValue?: string;
  newValue?: string;
  actor?: string; // 'rule_engine' | 'owner_manual' | 'reconciliation_matcher'
  canRevert?: boolean;
}

export interface Transaction {
  id: string; // Deterministic Plaid transaction_id or content-hash
  sourceTxId?: string; // Immutable source identifier from bank feed or CSV
  importBatchId?: string; // Lineage to raw immutable payload batch
  importedAt?: string; // Timestamp of raw file import
  plaidPendingTransactionId?: string | null; // For pending -> posted lifecycle link
  rawBatchId?: string; // Lineage to raw immutable payload batch
  rawSourceIndex?: number;
  accountId: string;
  accountName: string;
  institution: string;
  date: string; // YYYY-MM-DD
  authorizedDate?: string;
  rawDescription: string;
  merchantName: string;
  cleanMerchant: string;
  amount: number; // Positive = Outflow (expense/debit), Negative = Inflow (income/credit)
  currency: string;
  pending: boolean;
  status?: 'posted' | 'pending' | 'unknown';
  category: string[];
  classification: TransactionClassification;
  entity?: FinancialEntity; // Fixed entity separation
  auditTrail: AuditTrailEntry[];
  anomalies: AnomalyItem[];
  isTransferCounterpart?: boolean;
  transferCounterpartId?: string;
  isCreditCardPayment?: boolean;
  linkedCardAccountId?: string;
  subscriptionId?: string;
  isRefund?: boolean;
  refundedTxId?: string;
  notes?: string;
}

export interface RawPayloadBatch {
  id: string;
  timestamp: string;
  sha256: string;
  format: 'plaid_json' | 'plaid_csv';
  rawPayload: string;
  sourceName: string;
  itemCount: number;
}

export interface ReconciliationReport {
  id: string;
  batchId: string;
  timestamp: string;
  newTransactions: Transaction[];
  modifiedTransactions: Array<{
    txId: string;
    before: { amount: number; pending: boolean; name: string; date: string };
    after: { amount: number; pending: boolean; name: string; date: string };
    changes: string[];
  }>;
  pendingToPosted: Array<{
    pendingTxId: string;
    postedTxId: string;
    originalHoldAmount: number;
    finalSettledAmount: number;
    amountDelta: number;
    originalName: string;
    finalName: string;
  }>;
  removedOrReversed: Array<{
    txId: string;
    reason: string;
    amount: number;
    accountName: string;
  }>;
  matchedTransfers: Array<{
    outflowTxId: string;
    inflowTxId: string;
    amount: number;
    outflowAccount: string;
    inflowAccount: string;
  }>;
  matchedCreditCardPayments: Array<{
    paymentOutflowTxId: string;
    paymentCreditTxId: string;
    amount: number;
    checkingAccount: string;
    creditCardAccount: string;
  }>;
  balanceChanges: Array<{
    accountId: string;
    accountName: string;
    institution: string;
    oldCurrent: number;
    newCurrent: number;
    delta: number;
    oldAvailable: number | null;
    newAvailable: number | null;
  }>;
  newAccounts: Account[];
  missingAccounts: Account[];
  staleAccounts: Account[];
  connectionErrors: Array<{ accountId: string; institution: string; error: string }>;
  needsReviewTransactions: Transaction[];
}

export interface HealthDimension {
  dimension: 'connection' | 'tx_freshness' | 'balance_freshness' | 'coverage' | 'reconciliation';
  name: string;
  status: 'healthy' | 'partial' | 'stale' | 'unknown' | 'error';
  detail: string;
}

export interface InstitutionHealth {
  name: string;
  accountCount: number;
  lastSyncTimestamp: string;
  sourceBalanceTimestamp: string | null;
  status: 'active' | 'sync_error' | 'disconnected' | 'stale' | 'partial';
  errorDetails?: string;
  dimensions: HealthDimension[];
  transactionCoverage: {
    earliestDate: string;
    latestDate: string;
    count: number;
  };
}

export interface UnresolvedIssue {
  id: string;
  category: 'stale_feed' | 'unreviewed_tx' | 'null_balance' | 'mismatched_transfer' | 'possible_duplicate' | 'connection_error';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedEntityId: string;
  entityType: 'account' | 'transaction' | 'connection';
}

export interface FinancialDataHealth {
  overallConfidenceScore: number; // 0 - 100
  status: 'healthy' | 'warning' | 'degraded' | 'critical';
  confidenceFactors: Array<{ factor: string; scoreDelta: number; reason: string }>;
  institutions: InstitutionHealth[];
  unresolvedIssues: UnresolvedIssue[];
  totalActiveAccounts: number;
  totalTransactionsRecorded: number;
  unreviewedTransactionsCount: number;
}

export interface MetricLineageEvidence {
  id: string;
  label: string;
  amount: number;
  detail?: string;
  type?: string;
}

export interface MetricLineageComponent {
  name: string;
  value: number;
  operation: 'add' | 'subtract' | 'divide' | 'base';
  sourceType: 'account_balance' | 'pending_hold' | 'obligation' | 'transaction_sum' | 'credit_limit';
  evidence: MetricLineageEvidence[];
}

export interface MetricLineage {
  metricKey: string;
  metricName: string;
  finalValue: string;
  formattedValue: string;
  formula: string;
  explanation: string;
  components: MetricLineageComponent[];
}

export type SubscriptionConfidence = 'candidate_observed_once' | 'recurrence_detected' | 'owner_confirmed';

export interface Subscription {
  id: string;
  cleanMerchant: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  averageAmount: number;
  lastAmount: number;
  previousAmount?: number;
  priceChangePercent?: number;
  lastBilledDate: string;
  nextEstimatedDate: string;
  category: string;
  accountName: string;
  accountId: string;
  status: 'active' | 'price_increased' | 'review_needed';
  transactionCount: number;
  confidence: SubscriptionConfidence;
  isEstimatedDate: boolean;
  userOverridden?: boolean;
}

export interface UpcomingObligation {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
  type: 'subscription' | 'loan_payment' | 'credit_card_bill' | 'payroll';
  accountName: string;
  isUrgent?: boolean;
}

export interface DailyBriefing {
  generatedAt: string;
  cashSummary: {
    totalSettledCash: number;
    availableLiquidity: number;
    businessSettledCash: number;
    personalSettledCash: number;
    businessAvailableLiquidity: number;
    personalAvailableLiquidity: number;
    committedHold: number;
    netCashChange24h: number;
    burnRate7d: number;
    hasStaleFeedsWarning: boolean;
    staleFeedsCount: number;
    restrictedCollateral?: number;
    dataTimestamp: string;
    coverageWarning?: string;
  };
  debtSummary: {
    totalCreditDebt: number;
    totalCreditLimit: number;
    blendedUtilization: number;
    highUtilizationCount: number;
    totalLoanBalance: number;
    debtChange24h: number;
  };
  spendSummary: {
    totalSpend24h: number;
    businessSpend24h: number;
    personalSpend24h: number;
    largestTransaction: Transaction | null;
  };
  pendingSummary: {
    pendingCount: number;
    pendingOutflows: number;
    pendingInflows: number;
  };
  upcomingObligations: UpcomingObligation[];
  syncHealth: {
    totalAccounts: number;
    activeCount: number;
    staleCount: number;
    staleAccounts: Account[];
  };
  reviewItems: {
    needsReviewCount: number;
    anomaliesCount: number;
    urgentActionItems: string[];
  };
}

export interface SyncDiff {
  syncTimestamp: string;
  previousSyncTimestamp: string;
  newTransactions: Transaction[];
  pendingToPosted: Transaction[];
  newAnomalies: { transaction: Transaction; anomaly: AnomalyItem }[];
  balanceDeltas: {
    accountId: string;
    accountName: string;
    institution: string;
    previousBalance: number;
    currentBalance: number;
    delta: number;
  }[];
}

export interface UtilizationThresholds {
  warningThreshold: number; // default 30%
  dangerThreshold: number; // default 50%
  criticalThreshold: number; // default 80%
}

export interface FilterState {
  search: string;
  status: 'all' | 'posted' | 'pending';
  classification: 'all' | TransactionClassification;
  accountId: 'all' | string;
  entity: 'all' | FinancialEntity;
  hasAnomalyOnly: boolean;
  dateRange: 'all' | '7d' | '30d' | '90d';
}

export interface FinancialNote {
  id: string;
  category: string;
  noteText: string;
  createdDate: string;
  associatedEntity?: string;
  author?: string;
}

export interface ImportReconciliationSummary {
  rowsRead: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicatesSkippedCount: number;
  unknownRecordTypesCount: number;
  totalsByRecordType: {
    transaction: number;
    account_snapshot: number;
    bill: number;
    loan: number;
    notes_assumptions: number;
  };
  rejections: Array<{ rowNumber: number; reason: string; rawRow: Record<string, any> }>;
  duplicates: Array<{ transactionId: string; rowNumber: number }>;
  unknownTypes: Array<{ rowNumber: number; rawType: string }>;
  unmatchedAccounts?: Array<{ accountName: string; txCount: number; totalAmount: number }>;
  fileMetadata?: {
    fileName: string;
    fileSize: string;
    sha256?: string;
    rawDebitsSum: number;
    rawCreditsSum: number;
    rawNetSum: number;
  };
  variance?: {
    rawDebits: number;
    rawCredits: number;
    stagedDebits: number;
    stagedCredits: number;
    deltaDebits: number;
    deltaCredits: number;
    explanation: string;
  };
  parsedAccounts: Account[];
  parsedTransactions: Transaction[];
  parsedBills: Subscription[];
  parsedLoans: Account[];
  parsedNotes: FinancialNote[];
}
