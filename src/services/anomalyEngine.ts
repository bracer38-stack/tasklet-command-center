import { Account, AnomalyItem, Transaction } from '../types';

/**
 * Anomaly Detection Engine.
 * Identifies duplicate charges, unexpected merchants, unusually large purchases,
 * and classification discrepancies.
 */

const PERSONAL_EXPENSE_KEYWORDS = [
  'steam games',
  'playstation',
  'nintendo',
  'netflix',
  'spotify personal',
  'target retail',
  'trader joe',
  'whole foods',
  'sephora',
  'disney+',
  'hulu',
  'gym membership',
  'equinox',
];

const WORK_VENDOR_KEYWORDS = ['aws', 'github', 'wework'];

// Whole-word match so e.g. 'aws' does not match 'shaws'.
function containsKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = /^\w/.test(keyword) ? '\\b' : '';
  const end = /\w$/.test(keyword) ? '\\b' : '';
  return new RegExp(`${start}${escaped}${end}`).test(text);
}

export function detectAnomalies(
  transactions: Transaction[],
  accounts: Account[]
): Transaction[] {
  const accountMap = new Map<string, Account>();
  accounts.forEach((a) => accountMap.set(a.id, a));

  // Compute category averages for large purchase detection
  const categoryAmounts = new Map<string, number[]>();
  for (const t of transactions) {
    if (t.amount > 0 && !t.isTransferCounterpart && !t.isCreditCardPayment) {
      const cat = t.category?.[0] || 'General';
      if (!categoryAmounts.has(cat)) {
        categoryAmounts.set(cat, []);
      }
      categoryAmounts.get(cat)!.push(t.amount);
    }
  }

  const categoryStats = new Map<string, { mean: number; threshold: number }>();
  for (const [cat, amounts] of categoryAmounts.entries()) {
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    // Threshold is either 3x the mean or $2,500, whichever is greater
    const threshold = Math.max(mean * 3, 2000);
    categoryStats.set(cat, { mean, threshold });
  }

  // Clone transactions with fresh anomalies list
  const enrichedTxs = transactions.map((t) => ({
    ...t,
    anomalies: [...t.anomalies],
  }));

  // 1. Detect Duplicate Charges (same merchant, same amount, same account within 72 hrs)
  for (let i = 0; i < enrichedTxs.length; i++) {
    const tx1 = enrichedTxs[i];
    if (tx1.amount <= 0 || tx1.isTransferCounterpart || tx1.isCreditCardPayment) continue;

    for (let j = i + 1; j < enrichedTxs.length; j++) {
      const tx2 = enrichedTxs[j];
      if (tx2.amount <= 0 || tx2.isTransferCounterpart || tx2.isCreditCardPayment) continue;

      if (
        tx1.accountId === tx2.accountId &&
        Math.abs(tx1.amount - tx2.amount) < 0.01 &&
        tx1.cleanMerchant.toLowerCase() === tx2.cleanMerchant.toLowerCase()
      ) {
        const d1 = new Date(tx1.date).getTime();
        const d2 = new Date(tx2.date).getTime();
        const diffHours = Math.abs(d1 - d2) / (1000 * 60 * 60);

        if (diffHours <= 72) {
          // Flag both transactions with possible duplicate anomaly
          const msg = `Possible duplicate — verify ($${tx1.amount.toFixed(2)} with "${tx1.cleanMerchant}" within ${Math.round(diffHours)}h). Kept in totals pending owner verification.`;
          
          if (!tx1.anomalies.some((a) => a.type === 'duplicate_charge')) {
            tx1.anomalies.push({
              id: `anom_dup_${tx1.id}_${tx2.id}`,
              type: 'duplicate_charge',
              severity: 'medium',
              message: msg,
              details: `Matches transaction #${tx2.id} on ${tx2.date}. May represent legitimate separate seats/proration or duplicate swipe. Retained in ledger totals until verified.`,
            });
          }

          if (!tx2.anomalies.some((a) => a.type === 'duplicate_charge')) {
            tx2.anomalies.push({
              id: `anom_dup_${tx2.id}_${tx1.id}`,
              type: 'duplicate_charge',
              severity: 'medium',
              message: msg,
              details: `Matches transaction #${tx1.id} on ${tx1.date}. May represent legitimate separate seats/proration or duplicate swipe. Retained in ledger totals until verified.`,
            });
          }
        }
      }
    }
  }

  // 2. Unusually Large Purchases & Unexpected Merchants & Classification Anomalies
  for (const tx of enrichedTxs) {
    if (tx.amount <= 0 || tx.isTransferCounterpart || tx.isCreditCardPayment) continue;

    const acc = accountMap.get(tx.accountId);
    const cat = tx.category?.[0] || 'General';
    const stats = categoryStats.get(cat);

    // Unusually Large
    if (stats && tx.amount >= stats.threshold && tx.amount > 1500) {
      if (!tx.anomalies.some((a) => a.type === 'unusually_large')) {
        tx.anomalies.push({
          id: `anom_large_${tx.id}`,
          type: 'unusually_large',
          severity: tx.amount > 5000 ? 'high' : 'medium',
          message: `Unusually large transaction: $${tx.amount.toFixed(2)} exceeds normal category range (avg $${stats.mean.toFixed(2)}).`,
          details: `Requires owner review for receipt capture, tax deductibility, or budget allocation.`,
        });
      }
    }

    // Classification Anomaly: Personal keyword on Business Account
    const descLower = `${tx.rawDescription} ${tx.cleanMerchant}`.toLowerCase();
    const isPersonalKeyword = PERSONAL_EXPENSE_KEYWORDS.some((kw) => containsKeyword(descLower, kw));

    if (acc?.isBusiness && isPersonalKeyword && tx.classification === 'business') {
      if (!tx.anomalies.some((a) => a.type === 'classification_anomaly')) {
        tx.anomalies.push({
          id: `anom_class_${tx.id}`,
          type: 'classification_anomaly',
          severity: 'medium',
          message: `Personal expense detected on business account (${acc.name}).`,
          details: `Contains personal merchant indicator. Reclassify as Personal Draw or reimbursement to protect business tax records.`,
        });
        tx.classification = 'needs_review';
      }
    }

    // Business expense on Personal Account without reimbursement flag
    if (!acc?.isBusiness && WORK_VENDOR_KEYWORDS.some((kw) => containsKeyword(descLower, kw)) && tx.classification !== 'reimbursement') {
      if (!tx.anomalies.some((a) => a.type === 'classification_anomaly')) {
        tx.anomalies.push({
          id: `anom_reimb_${tx.id}`,
          type: 'classification_anomaly',
          severity: 'low',
          message: `Potential business expense on personal card (${acc?.name || 'Personal'}).`,
          details: `Looks like a work vendor (${tx.cleanMerchant}). Mark as Reimbursement if you intend to expense this to the company.`,
        });
      }
    }
  }

  return enrichedTxs;
}
