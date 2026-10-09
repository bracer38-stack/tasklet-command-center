import {
  Account,
  ReconciliationReport,
  Transaction,
  TransactionClassification,
} from '../types';
import { detectTransfers } from './transferEngine';
import { detectAnomalies } from './anomalyEngine';
import { classifyTransaction } from './classificationEngine';

/**
 * Rigorous Plaid Reconciliation Engine.
 * Idempotently reconciles incoming raw-normalized feeds against existing state.
 * Emits full reconciliation reports and guarantees zero phantom records.
 */

export interface IngestionInput {
  incomingAccounts: Account[];
  incomingTransactions: Transaction[];
  removedTransactionIds?: string[];
  rawBatchId: string;
}

export function reconcileFinancialState(
  existingAccounts: Account[],
  existingTransactions: Transaction[],
  input: IngestionInput
): {
  reconciledAccounts: Account[];
  reconciledTransactions: Transaction[];
  report: ReconciliationReport;
} {
  const timestamp = new Date().toISOString();
  const reportId = `recon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const existingTxMap = new Map<string, Transaction>();
  existingTransactions.forEach((t) => existingTxMap.set(t.id, t));

  const existingAccMap = new Map<string, Account>();
  existingAccounts.forEach((a) => existingAccMap.set(a.id, a));

  const incomingAccMap = new Map<string, Account>();
  input.incomingAccounts.forEach((a) => incomingAccMap.set(a.id, a));

  // --- 1. Reconcile Accounts ---
  const reconciledAccounts: Account[] = [];
  const newAccounts: Account[] = [];
  const missingAccounts: Account[] = [];
  const staleAccounts: Account[] = [];
  const connectionErrors: Array<{ accountId: string; institution: string; error: string }> = [];
  const balanceChanges: ReconciliationReport['balanceChanges'] = [];

  // Check existing accounts against incoming
  for (const [id, oldAcc] of existingAccMap.entries()) {
    const incomingAcc = incomingAccMap.get(id);
    if (!incomingAcc) {
      // Account omitted from incoming feed! Flag as missing
      missingAccounts.push(oldAcc);
      reconciledAccounts.push(oldAcc);
    } else {
      // Account exists in both: compute balance deltas
      const delta = incomingAcc.currentBalance - oldAcc.currentBalance;
      if (
        Math.abs(delta) > 0.001 ||
        oldAcc.availableBalance !== incomingAcc.availableBalance
      ) {
        balanceChanges.push({
          accountId: id,
          accountName: incomingAcc.name,
          institution: incomingAcc.institution,
          oldCurrent: oldAcc.currentBalance,
          newCurrent: incomingAcc.currentBalance,
          delta,
          oldAvailable: oldAcc.availableBalance,
          newAvailable: incomingAcc.availableBalance,
        });
      }

      // Check stale status (>72h)
      const syncTime = new Date(incomingAcc.lastSyncedAt).getTime();
      const isStale = Date.now() - syncTime > 72 * 60 * 60 * 1000 || incomingAcc.status === 'sync_error';
      if (isStale) {
        staleAccounts.push({ ...incomingAcc, isStale: true });
      }

      if (incomingAcc.status === 'sync_error' || incomingAcc.status === 'disconnected') {
        connectionErrors.push({
          accountId: id,
          institution: incomingAcc.institution,
          error: incomingAcc.staleReason || 'Connection credentials or MFA expired',
        });
      }

      reconciledAccounts.push({
        ...incomingAcc,
        isStale,
      });
    }
  }

  // Check for brand new incoming accounts
  for (const [id, incAcc] of incomingAccMap.entries()) {
    if (!existingAccMap.has(id)) {
      newAccounts.push(incAcc);
      reconciledAccounts.push(incAcc);
      balanceChanges.push({
        accountId: id,
        accountName: incAcc.name,
        institution: incAcc.institution,
        oldCurrent: 0,
        newCurrent: incAcc.currentBalance,
        delta: incAcc.currentBalance,
        oldAvailable: null,
        newAvailable: incAcc.availableBalance,
      });
    }
  }

  // --- 2. Reconcile Transactions & Idempotency ---
  const activeTxMap = new Map<string, Transaction>(existingTxMap);
  const newTransactions: Transaction[] = [];
  const modifiedTransactions: ReconciliationReport['modifiedTransactions'] = [];
  const pendingToPosted: ReconciliationReport['pendingToPosted'] = [];
  const removedOrReversed: ReconciliationReport['removedOrReversed'] = [];

  // Track pending transaction IDs to match promotions
  const pendingTxs = Array.from(activeTxMap.values()).filter((t) => t.pending);

  for (const incTx of input.incomingTransactions) {
    // If incoming transaction has not been classified yet, classify it now
    if (incTx.auditTrail.length === 0) {
      const matchedAccount = reconciledAccounts.find((a) => a.id === incTx.accountId);
      const { classification, auditEntry } = classifyTransaction(incTx, matchedAccount);
      incTx.classification = classification;
      incTx.auditTrail.push(auditEntry);
    }

    const existing = activeTxMap.get(incTx.id);

    if (existing) {
      // Transaction ID already exists! Check for modifications or pending->posted promotion
      const hasPendingChange = existing.pending && !incTx.pending;
      const hasAmountChange = Math.abs(existing.amount - incTx.amount) > 0.001;
      const hasNameChange = existing.cleanMerchant !== incTx.cleanMerchant || existing.rawDescription !== incTx.rawDescription;
      const hasDateChange = existing.date !== incTx.date;

      if (hasPendingChange) {
        pendingToPosted.push({
          pendingTxId: existing.id,
          postedTxId: incTx.id,
          originalHoldAmount: existing.amount,
          finalSettledAmount: incTx.amount,
          amountDelta: incTx.amount - existing.amount,
          originalName: existing.rawDescription,
          finalName: incTx.rawDescription,
        });

        const updatedTx: Transaction = {
          ...existing,
          ...incTx,
          // Preserve prior manual user override if any!
          classification: existing.auditTrail.some((a) => a.userOverridden)
            ? existing.classification
            : incTx.classification,
          auditTrail: existing.auditTrail,
          anomalies: incTx.anomalies,
        };
        activeTxMap.set(incTx.id, updatedTx);
      } else if (hasAmountChange || hasNameChange || hasDateChange) {
        const changes: string[] = [];
        if (hasAmountChange) changes.push(`Amount changed from $${existing.amount.toFixed(2)} to $${incTx.amount.toFixed(2)}`);
        if (hasNameChange) changes.push(`Description updated from "${existing.rawDescription}" to "${incTx.rawDescription}"`);
        if (hasDateChange) changes.push(`Date adjusted from ${existing.date} to ${incTx.date}`);

        modifiedTransactions.push({
          txId: incTx.id,
          before: {
            amount: existing.amount,
            pending: existing.pending,
            name: existing.rawDescription,
            date: existing.date,
          },
          after: {
            amount: incTx.amount,
            pending: incTx.pending,
            name: incTx.rawDescription,
            date: incTx.date,
          },
          changes,
        });

        activeTxMap.set(incTx.id, {
          ...existing,
          ...incTx,
          classification: existing.auditTrail.some((a) => a.userOverridden)
            ? existing.classification
            : incTx.classification,
          auditTrail: existing.auditTrail,
        });
      } else {
        // EXACT IDENTICAL TRANSACTION: IDEMPOTENT NO-OP!
        // Do not mutate or duplicate.
      }
    } else {
      // Check if this incoming transaction promotes an existing pending transaction via plaidPendingTransactionId
      let matchedPending: Transaction | undefined;

      if (incTx.plaidPendingTransactionId) {
        matchedPending = activeTxMap.get(incTx.plaidPendingTransactionId);
      }

      // Secondary promotion heuristic: match pending charge by account + approximate date + clean merchant
      if (!matchedPending && !incTx.pending) {
        matchedPending = pendingTxs.find((p) => {
          if (p.accountId !== incTx.accountId) return false;
          const pDate = new Date(p.date).getTime();
          const iDate = new Date(incTx.date).getTime();
          const daysDiff = Math.abs(pDate - iDate) / (1000 * 60 * 60 * 24);
          if (daysDiff > 5) return false;

          const sameMerchant =
            p.cleanMerchant.toLowerCase() === incTx.cleanMerchant.toLowerCase() ||
            incTx.rawDescription.toLowerCase().includes(p.cleanMerchant.toLowerCase());

          // Match if merchant matches and amount is within 30% (tip variance)
          const amountRatio = incTx.amount / (p.amount || 1);
          return sameMerchant && amountRatio >= 0.8 && amountRatio <= 1.4;
        });
      }

      if (matchedPending) {
        // Pending transaction promoted to posted with new ID!
        pendingToPosted.push({
          pendingTxId: matchedPending.id,
          postedTxId: incTx.id,
          originalHoldAmount: matchedPending.amount,
          finalSettledAmount: incTx.amount,
          amountDelta: incTx.amount - matchedPending.amount,
          originalName: matchedPending.rawDescription,
          finalName: incTx.rawDescription,
        });

        // Remove old pending hold from active ledger to prevent double-counting!
        activeTxMap.delete(matchedPending.id);

        const promotedTx: Transaction = {
          ...incTx,
          auditTrail: matchedPending.auditTrail.some((a) => a.userOverridden)
            ? matchedPending.auditTrail
            : incTx.auditTrail,
          classification: matchedPending.auditTrail.some((a) => a.userOverridden)
            ? matchedPending.classification
            : incTx.classification,
        };
        activeTxMap.set(incTx.id, promotedTx);
        newTransactions.push(promotedTx);
      } else {
        // Brand new transaction
        newTransactions.push(incTx);
        activeTxMap.set(incTx.id, incTx);
      }
    }
  }

  // Handle explicit removals (Plaid `removed: [{ transaction_id }]`)
  if (input.removedTransactionIds && input.removedTransactionIds.length > 0) {
    for (const remId of input.removedTransactionIds) {
      const target = activeTxMap.get(remId);
      if (target) {
        removedOrReversed.push({
          txId: remId,
          reason: 'Plaid removal notice: authorization dropped or transaction canceled',
          amount: target.amount,
          accountName: target.accountName,
        });
        activeTxMap.delete(remId);
      }
    }
  }

  // --- 3. Reconcile Transfers & Debt Payments ---
  const currentTxList = Array.from(activeTxMap.values());
  const { updatedTransactions: afterTransfers, detectedMatches } = detectTransfers(
    currentTxList,
    reconciledAccounts
  );

  const matchedTransfers = detectedMatches
    .filter((m) => m.matchType === 'internal_transfer')
    .map((m) => ({
      outflowTxId: m.outflowTxId,
      inflowTxId: m.inflowTxId,
      amount: m.amount,
      outflowAccount: m.outflowAccount,
      inflowAccount: m.inflowAccount,
    }));

  const matchedCreditCardPayments = detectedMatches
    .filter((m) => m.matchType === 'credit_card_payment')
    .map((m) => ({
      paymentOutflowTxId: m.outflowTxId,
      paymentCreditTxId: m.inflowTxId,
      amount: m.amount,
      checkingAccount: m.outflowAccount,
      creditCardAccount: m.inflowAccount,
    }));

  // --- 4. Reconcile Anomalies ---
  const finalTransactions = detectAnomalies(afterTransfers, reconciledAccounts);

  // --- 5. Strict Zero-Guessing: Collect Needs Review Transactions ---
  const needsReviewTransactions = finalTransactions.filter(
    (t) => t.classification === 'needs_review'
  );

  const report: ReconciliationReport = {
    id: reportId,
    batchId: input.rawBatchId,
    timestamp,
    newTransactions,
    modifiedTransactions,
    pendingToPosted,
    removedOrReversed,
    matchedTransfers,
    matchedCreditCardPayments,
    balanceChanges,
    newAccounts,
    missingAccounts,
    staleAccounts,
    connectionErrors,
    needsReviewTransactions,
  };

  return {
    reconciledAccounts,
    reconciledTransactions: finalTransactions,
    report,
  };
}
