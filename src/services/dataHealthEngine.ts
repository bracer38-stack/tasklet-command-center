import { Account, FinancialDataHealth, HealthDimension, InstitutionHealth, Transaction, UnresolvedIssue } from '../types';

/**
 * Financial Data Health Engine.
 * Evaluates institution sync freshness, source balance timestamps, transaction coverage,
 * unresolved reconciliation discrepancies, and computes an overall Confidence Score.
 * Separately evaluates:
 *  1. Connection Status
 *  2. Transaction Freshness
 *  3. Balance Freshness
 *  4. Coverage Completeness
 *  5. Reconciliation State
 */

export function evaluateDataHealth(
  accounts: Account[],
  transactions: Transaction[]
): FinancialDataHealth {
  const unresolvedIssues: UnresolvedIssue[] = [];
  const confidenceFactors: Array<{ factor: string; scoreDelta: number; reason: string }> = [];

  let currentScore = 100;
  const now = new Date();

  // 1. Group Accounts by Institution
  const institutionMap = new Map<string, Account[]>();
  for (const acc of accounts) {
    const inst = acc.institution || 'Unknown Institution';
    if (!institutionMap.has(inst)) {
      institutionMap.set(inst, []);
    }
    institutionMap.get(inst)!.push(acc);
  }

  const institutions: InstitutionHealth[] = [];

  for (const [instName, instAccounts] of institutionMap.entries()) {
    const instTxs = transactions.filter((t) =>
      instAccounts.some((a) => a.id === t.accountId)
    );

    let earliestDate = instTxs.length > 0 ? instTxs[0].date : 'N/A';
    let latestDate = instTxs.length > 0 ? instTxs[0].date : 'N/A';

    for (const t of instTxs) {
      if (t.date < earliestDate) earliestDate = t.date;
      if (t.date > latestDate) latestDate = t.date;
    }

    const hasError = instAccounts.some(
      (a) => a.status === 'sync_error' || a.status === 'disconnected'
    );
    const hasStale = instAccounts.some((a) => a.isStale);

    const latestSync = instAccounts.reduce(
      (latest, a) => (a.lastSyncedAt > latest ? a.lastSyncedAt : latest),
      instAccounts[0]?.lastSyncedAt || new Date().toISOString()
    );

    const sourceBalanceTimestamp = instAccounts[0]?.sourceBalanceTimestamp || latestSync;

    // 5-Dimension Evaluation
    const dimensions: HealthDimension[] = [];

    // Dimension 1: Connection Status
    if (hasError) {
      dimensions.push({
        dimension: 'connection',
        name: 'Connection Status',
        status: 'error',
        detail: instAccounts.find((a) => a.staleReason)?.staleReason || 'Feed error / MFA expired',
      });
    } else {
      dimensions.push({
        dimension: 'connection',
        name: 'Connection Status',
        status: 'healthy',
        detail: 'Active feed connection',
      });
    }

    // Dimension 2: Transaction Freshness
    if (instTxs.length === 0) {
      dimensions.push({
        dimension: 'tx_freshness',
        name: 'Transaction Freshness',
        status: 'unknown',
        detail: 'No transactions imported',
      });
    } else {
      const daysSinceTx =
        (now.getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceTx > 4) {
        dimensions.push({
          dimension: 'tx_freshness',
          name: 'Transaction Freshness',
          status: 'stale',
          detail: `Last transaction ${latestDate} (${Math.round(daysSinceTx)}d ago)`,
        });
      } else if (daysSinceTx > 2) {
        dimensions.push({
          dimension: 'tx_freshness',
          name: 'Transaction Freshness',
          status: 'partial',
          detail: `Last transaction ${latestDate} (gap > 48h)`,
        });
      } else {
        dimensions.push({
          dimension: 'tx_freshness',
          name: 'Transaction Freshness',
          status: 'healthy',
          detail: `Recent activity through ${latestDate}`,
        });
      }
    }

    // Dimension 3: Balance Freshness
    if (hasStale) {
      dimensions.push({
        dimension: 'balance_freshness',
        name: 'Balance Freshness',
        status: 'stale',
        detail: 'Balance sync is > 72h old',
      });
    } else {
      dimensions.push({
        dimension: 'balance_freshness',
        name: 'Balance Freshness',
        status: 'healthy',
        detail: 'Verified recent statement balance',
      });
    }

    // Dimension 4: Coverage Completeness
    if (instTxs.length === 0) {
      dimensions.push({
        dimension: 'coverage',
        name: 'Coverage Completeness',
        status: 'unknown',
        detail: 'Zero transaction coverage',
      });
    } else if (instTxs.length < 5) {
      dimensions.push({
        dimension: 'coverage',
        name: 'Coverage Completeness',
        status: 'partial',
        detail: `Sparse coverage: only ${instTxs.length} transaction(s)`,
      });
    } else {
      dimensions.push({
        dimension: 'coverage',
        name: 'Coverage Completeness',
        status: 'healthy',
        detail: `Comprehensive coverage: ${instTxs.length} transactions`,
      });
    }

    // Dimension 5: Reconciliation State
    const unreviewedCount = instTxs.filter((t) => t.classification === 'needs_review').length;
    if (unreviewedCount > 0) {
      dimensions.push({
        dimension: 'reconciliation',
        name: 'Reconciliation State',
        status: 'partial',
        detail: `${unreviewedCount} transaction(s) pending review`,
      });
    } else {
      dimensions.push({
        dimension: 'reconciliation',
        name: 'Reconciliation State',
        status: 'healthy',
        detail: 'All transactions categorized',
      });
    }

    // Determine aggregate institution status:
    // Any error -> sync_error
    // Any stale -> stale
    // Any partial or unknown -> partial
    // All healthy -> active
    let status: InstitutionHealth['status'] = 'active';
    if (dimensions.some((d) => d.status === 'error')) {
      status = 'sync_error';
    } else if (dimensions.some((d) => d.status === 'stale')) {
      status = 'stale';
    } else if (dimensions.some((d) => d.status === 'partial' || d.status === 'unknown')) {
      status = 'partial';
    }

    institutions.push({
      name: instName,
      accountCount: instAccounts.length,
      lastSyncTimestamp: latestSync,
      sourceBalanceTimestamp,
      status,
      errorDetails: instAccounts.find((a) => a.staleReason)?.staleReason,
      dimensions,
      transactionCoverage: {
        earliestDate,
        latestDate,
        count: instTxs.length,
      },
    });

    // Penalties for institution connection failures
    if (hasError) {
      currentScore -= 20;
      confidenceFactors.push({
        factor: `${instName} Connection Error`,
        scoreDelta: -20,
        reason: `Bank feed in error status. Re-authentication required.`,
      });
      unresolvedIssues.push({
        id: `iss_err_${instName}`,
        category: 'connection_error',
        description: `Institution ${instName} has feed errors: ${
          instAccounts.find((a) => a.staleReason)?.staleReason || 'MFA required'
        }`,
        severity: 'high',
        affectedEntityId: instAccounts[0].id,
        entityType: 'connection',
      });
    } else if (hasStale) {
      currentScore -= 12;
      confidenceFactors.push({
        factor: `${instName} Stale Feed`,
        scoreDelta: -12,
        reason: `Last sync was over 72 hours ago.`,
      });
      unresolvedIssues.push({
        id: `iss_stale_${instName}`,
        category: 'stale_feed',
        description: `Institution ${instName} data is stale (>72h). Balances may be outdated.`,
        severity: 'medium',
        affectedEntityId: instAccounts[0].id,
        entityType: 'account',
      });
    } else if (status === 'partial') {
      currentScore -= 5;
      confidenceFactors.push({
        factor: `${instName} Partial / Sparse Feed`,
        scoreDelta: -5,
        reason: `Feed has sparse transactions or older dates.`,
      });
    }
  }

  // 2. Check for Null / Unavailable Balances
  for (const acc of accounts) {
    if (acc.availableBalance === null) {
      currentScore -= 5;
      confidenceFactors.push({
        factor: `Unavailable Balance on ${acc.name}`,
        scoreDelta: -5,
        reason: `Account does not report available liquidity.`,
      });
      unresolvedIssues.push({
        id: `iss_nullbal_${acc.id}`,
        category: 'null_balance',
        description: `Account "${acc.name}" reports null available balance from bank.`,
        severity: 'medium',
        affectedEntityId: acc.id,
        entityType: 'account',
      });
    }
  }

  // 3. Check for Unreviewed Transactions
  const unreviewedTxs = transactions.filter((t) => t.classification === 'needs_review');
  if (unreviewedTxs.length > 0) {
    const penalty = Math.min(15, unreviewedTxs.length * 3);
    currentScore -= penalty;
    confidenceFactors.push({
      factor: `${unreviewedTxs.length} Unreviewed Transactions`,
      scoreDelta: -penalty,
      reason: `Transactions in Needs Review status awaiting owner classification.`,
    });
    unresolvedIssues.push({
      id: 'iss_unreviewed_batch',
      category: 'unreviewed_tx',
      description: `${unreviewedTxs.length} transaction(s) require manual classification to prevent P&L skew.`,
      severity: unreviewedTxs.length > 3 ? 'high' : 'medium',
      affectedEntityId: unreviewedTxs[0]?.id || 'all',
      entityType: 'transaction',
    });
  }

  // 4. Check for Possible Duplicate Charge Anomalies
  const duplicateAnomalies = transactions.filter((t) =>
    t.anomalies.some((a) => a.type === 'duplicate_charge')
  );
  if (duplicateAnomalies.length > 0) {
    currentScore -= 8;
    confidenceFactors.push({
      factor: `${duplicateAnomalies.length} Suspected Duplicate Swipes`,
      scoreDelta: -8,
      reason: `Identical amounts with same merchant detected. Kept in totals until verified.`,
    });
    unresolvedIssues.push({
      id: 'iss_dup_batch',
      category: 'possible_duplicate',
      description: `${duplicateAnomalies.length} charge(s) marked 'Possible duplicate — verify'. Retained in totals.`,
      severity: 'medium',
      affectedEntityId: duplicateAnomalies[0].id,
      entityType: 'transaction',
    });
  }

  // Final score clamping
  const overallConfidenceScore = Math.max(10, Math.min(100, currentScore));

  let status: FinancialDataHealth['status'] = 'healthy';
  if (overallConfidenceScore < 60) status = 'critical';
  else if (overallConfidenceScore < 75) status = 'degraded';
  else if (overallConfidenceScore < 90) status = 'warning';

  return {
    overallConfidenceScore,
    status,
    confidenceFactors,
    institutions,
    unresolvedIssues,
    totalActiveAccounts: accounts.length,
    totalTransactionsRecorded: transactions.length,
    unreviewedTransactionsCount: unreviewedTxs.length,
  };
}
