import { Account, AnomalyItem, SyncDiff, Transaction } from '../types';

export function computeSyncDiff(
  previousTransactions: Transaction[],
  currentTransactions: Transaction[],
  previousAccounts: Account[],
  currentAccounts: Account[],
  previousSyncTimestamp: string
): SyncDiff {
  const syncTimestamp = new Date().toISOString();
  const prevTxMap = new Map<string, Transaction>();
  previousTransactions.forEach((t) => prevTxMap.set(t.id, t));

  const prevAccMap = new Map<string, Account>();
  previousAccounts.forEach((a) => prevAccMap.set(a.id, a));

  // 1. Identify New Transactions
  const newTransactions: Transaction[] = [];
  const pendingToPosted: Transaction[] = [];
  const newAnomalies: { transaction: Transaction; anomaly: AnomalyItem }[] = [];

  for (const currentTx of currentTransactions) {
    const prevTx = prevTxMap.get(currentTx.id);

    if (!prevTx) {
      newTransactions.push(currentTx);
      // Any anomalies on brand new transactions count as new anomalies
      currentTx.anomalies.forEach((anom) => {
        newAnomalies.push({ transaction: currentTx, anomaly: anom });
      });
    } else {
      // Check if status changed from pending to posted
      if (prevTx.pending && !currentTx.pending) {
        pendingToPosted.push(currentTx);
      }

      // Check if new anomalies emerged
      const prevAnomTypes = new Set(prevTx.anomalies.map((a) => a.type));
      currentTx.anomalies.forEach((anom) => {
        if (!prevAnomTypes.has(anom.type)) {
          newAnomalies.push({ transaction: currentTx, anomaly: anom });
        }
      });
    }
  }

  // 2. Identify Balance Deltas
  const balanceDeltas: SyncDiff['balanceDeltas'] = [];

  for (const currentAcc of currentAccounts) {
    const prevAcc = prevAccMap.get(currentAcc.id);
    const prevBal = prevAcc ? prevAcc.currentBalance : 0;
    const curBal = currentAcc.currentBalance;
    const delta = curBal - prevBal;

    balanceDeltas.push({
      accountId: currentAcc.id,
      accountName: currentAcc.name,
      institution: currentAcc.institution,
      previousBalance: prevBal,
      currentBalance: curBal,
      delta,
    });
  }

  return {
    syncTimestamp,
    previousSyncTimestamp,
    newTransactions,
    pendingToPosted,
    newAnomalies,
    balanceDeltas,
  };
}
