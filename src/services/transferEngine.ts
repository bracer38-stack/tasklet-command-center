import { Account, Transaction } from '../types';

/**
 * Transfer and Debt Payment Engine.
 * Detects internal account transfers and credit card payments to prevent double-counting.
 */

export interface TransferMatch {
  outflowTxId: string;
  inflowTxId: string;
  amount: number;
  outflowAccount: string;
  inflowAccount: string;
  daysApart: number;
  confidence: number;
  matchType: 'internal_transfer' | 'credit_card_payment';
}

const TRANSFER_KEYWORDS = [
  'transfer',
  'tfr',
  'internal tfr',
  'wire transfer',
  'ach transfer',
  'online transfer',
  'funds tfr',
  'xfer',
  'book transfer',
];

const CARD_PAYMENT_KEYWORDS = [
  'credit card payment',
  'card payment',
  'autopay amex',
  'american express payment',
  'chase credit crd epay',
  'capital one payment',
  'online payment - thank you',
  'payment received - thank you',
  'automatic payment - thank you',
  'epayment',
  'card payout',
];

export function detectTransfers(
  transactions: Transaction[],
  accounts: Account[]
): {
  updatedTransactions: Transaction[];
  detectedMatches: TransferMatch[];
} {
  const accountMap = new Map<string, Account>();
  accounts.forEach((acc) => accountMap.set(acc.id, acc));

  const matchedTxIds = new Set<string>();
  const matches: TransferMatch[] = [];

  // Clone transactions so we don't mutate input directly
  const txs = transactions.map((t) => ({ ...t, auditTrail: [...t.auditTrail] }));

  // Separate outflows and inflows
  // Outflows: amount > 0
  // Inflows: amount < 0 (stored as negative for inflows)
  const outflows = txs.filter((t) => t.amount > 0);
  const inflows = txs.filter((t) => t.amount < 0);

  for (const outTx of outflows) {
    if (matchedTxIds.has(outTx.id)) continue;

    const outAcc = accountMap.get(outTx.accountId);
    const outDate = new Date(outTx.date).getTime();
    const outDescLower = `${outTx.rawDescription} ${outTx.cleanMerchant}`.toLowerCase();

    // Check if this outflow looks like a credit card payment
    const looksLikeCardPayment = CARD_PAYMENT_KEYWORDS.some((kw) =>
      outDescLower.includes(kw)
    );

    for (const inTx of inflows) {
      if (matchedTxIds.has(inTx.id)) continue;
      // Do not pair transactions on the same account
      if (outTx.accountId === inTx.accountId) continue;

      const inAcc = accountMap.get(inTx.accountId);
      const inDate = new Date(inTx.date).getTime();
      const inDescLower = `${inTx.rawDescription} ${inTx.cleanMerchant}`.toLowerCase();

      // Check amount matching: outTx.amount is positive, inTx.amount is negative
      const amountDiff = Math.abs(outTx.amount - Math.abs(inTx.amount));
      if (amountDiff > 0.05) continue; // Allow up to 5 cents for rounding

      // Check date proximity: within 4 days (handling weekend ACH clearing)
      const daysApart = Math.abs(outDate - inDate) / (1000 * 60 * 60 * 24);
      if (daysApart > 4.5) continue;

      // Check if either is marked as transfer/payment or references institutions
      const hasTransferKeyword =
        TRANSFER_KEYWORDS.some(
          (kw) => outDescLower.includes(kw) || inDescLower.includes(kw)
        ) || looksLikeCardPayment;

      const mentionsOtherInstitution =
        (inAcc && outDescLower.includes(inAcc.institution.toLowerCase())) ||
        (outAcc && inDescLower.includes(outAcc.institution.toLowerCase())) ||
        (inAcc && outDescLower.includes(inAcc.name.toLowerCase())) ||
        (outAcc && inDescLower.includes(outAcc.name.toLowerCase()));

      const isCreditCardPair =
        (outAcc?.type === 'depository' && inAcc?.type === 'credit') ||
        looksLikeCardPayment ||
        inDescLower.includes('payment - thank you') ||
        inDescLower.includes('payment received');

      if (hasTransferKeyword || mentionsOtherInstitution || isCreditCardPair || daysApart <= 1) {
        // High confidence match!
        matchedTxIds.add(outTx.id);
        matchedTxIds.add(inTx.id);

        const matchType: TransferMatch['matchType'] = isCreditCardPair
          ? 'credit_card_payment'
          : 'internal_transfer';

        matches.push({
          outflowTxId: outTx.id,
          inflowTxId: inTx.id,
          amount: outTx.amount,
          outflowAccount: outAcc?.name || outTx.accountId,
          inflowAccount: inAcc?.name || inTx.accountId,
          daysApart: Math.round(daysApart),
          confidence: isCreditCardPair ? 0.98 : 0.96,
          matchType,
        });

        // Link transactions
        outTx.isTransferCounterpart = true;
        outTx.transferCounterpartId = inTx.id;
        inTx.isTransferCounterpart = true;
        inTx.transferCounterpartId = outTx.id;

        if (isCreditCardPair) {
          outTx.isCreditCardPayment = true;
          outTx.linkedCardAccountId = inTx.accountId;
          inTx.isCreditCardPayment = true;
          inTx.linkedCardAccountId = inTx.accountId;

          // Outflow from checking to pay card: classify as debt_payment
          if (!outTx.auditTrail.some((a) => a.userOverridden)) {
            outTx.classification = 'debt_payment';
            outTx.auditTrail.push({
              id: `audit_${Date.now()}_${outTx.id}`,
              timestamp: new Date().toISOString(),
              assignedClassification: 'debt_payment',
              ruleApplied: 'Credit Card Payment Pair Matcher',
              confidence: 0.98,
              reasoning: `Matched credit card payment outflow ($${outTx.amount.toFixed(2)}) against account "${inAcc?.name}". Prevents double counting spending.`,
              userOverridden: false,
            });
          }

          // Inflow on credit card (payment received): classify as debt_payment
          if (!inTx.auditTrail.some((a) => a.userOverridden)) {
            inTx.classification = 'debt_payment';
            inTx.auditTrail.push({
              id: `audit_${Date.now()}_${inTx.id}`,
              timestamp: new Date().toISOString(),
              assignedClassification: 'debt_payment',
              ruleApplied: 'Credit Card Payment Credit Matcher',
              confidence: 0.98,
              reasoning: `Payment received on card account "${inAcc?.name}" from checking account "${outAcc?.name}". Does not count as revenue.`,
              userOverridden: false,
            });
          }
        } else {
          // Internal transfer between bank accounts
          if (!outTx.auditTrail.some((a) => a.userOverridden)) {
            outTx.classification = 'transfer';
            outTx.auditTrail.push({
              id: `audit_${Date.now()}_${outTx.id}`,
              timestamp: new Date().toISOString(),
              assignedClassification: 'transfer',
              ruleApplied: 'Internal Transfer Pair Matcher',
              confidence: 0.96,
              reasoning: `Matched internal transfer counterpart #${inTx.id} on account "${inAcc?.name}". Excluded from P&L expenses.`,
              userOverridden: false,
            });
          }

          if (!inTx.auditTrail.some((a) => a.userOverridden)) {
            inTx.classification = 'transfer';
            inTx.auditTrail.push({
              id: `audit_${Date.now()}_${inTx.id}`,
              timestamp: new Date().toISOString(),
              assignedClassification: 'transfer',
              ruleApplied: 'Internal Transfer Pair Matcher',
              confidence: 0.96,
              reasoning: `Matched internal transfer deposit counterpart #${outTx.id} from account "${outAcc?.name}". Excluded from P&L revenue.`,
              userOverridden: false,
            });
          }
        }

        break; // Match found for outTx, move to next outflow
      }
    }
  }

  return {
    updatedTransactions: txs,
    detectedMatches: matches,
  };
}

/**
 * Calculates Operating Business Expenses, strictly excluding internal transfers
 * and credit card payments to prevent double counting.
 */
export function calculateOperatingExpenses(transactions: Transaction[]): number {
  return transactions
    .filter(
      (tx) =>
        tx.classification === 'business' &&
        tx.amount > 0 &&
        !tx.isCreditCardPayment &&
        !tx.isTransferCounterpart
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Calculates Business Revenue, strictly excluding internal transfers,
 * credit card payments, and loan proceeds.
 */
export function calculateOperatingRevenue(transactions: Transaction[]): number {
  return transactions
    .filter(
      (tx) =>
        tx.classification === 'income' &&
        tx.amount < 0 &&
        !tx.isTransferCounterpart
    )
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}
