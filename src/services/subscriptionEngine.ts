import { Subscription, Transaction } from '../types';

/**
 * Subscription and recurring expense detector.
 */

interface MerchantGroup {
  cleanMerchant: string;
  transactions: Transaction[];
}

export function detectSubscriptions(transactions: Transaction[]): {
  subscriptions: Subscription[];
  monthlyRunRate: number;
  annualRunRate: number;
} {
  // Only look at positive outflows (expenses)
  const expenseTxs = transactions.filter(
    (t) => t.amount > 0 && !t.isTransferCounterpart && !t.isCreditCardPayment
  );

  const groupMap = new Map<string, MerchantGroup>();

  for (const tx of expenseTxs) {
    const key = tx.cleanMerchant.toLowerCase().trim();
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        cleanMerchant: tx.cleanMerchant,
        transactions: [],
      });
    }
    groupMap.get(key)!.transactions.push(tx);
  }

  const subscriptions: Subscription[] = [];

  for (const [, group] of groupMap.entries()) {
    const txs = group.transactions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // If only 1 transaction, check if it's a known software/SaaS vendor pattern
    const isKnownSubscriptionVendor = isKnownSubscriptionMerchant(group.cleanMerchant);

    if (txs.length < 2 && !isKnownSubscriptionVendor) {
      continue;
    }

    // Calculate intervals between transactions if multiple
    let frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual' = 'monthly';
    let isRecurring = false;

    if (txs.length >= 2) {
      const intervalsInDays: number[] = [];
      for (let i = 1; i < txs.length; i++) {
        const diffDays =
          (new Date(txs[i].date).getTime() - new Date(txs[i - 1].date).getTime()) /
          (1000 * 60 * 60 * 24);
        intervalsInDays.push(diffDays);
      }

      const avgInterval =
        intervalsInDays.reduce((a, b) => a + b, 0) / intervalsInDays.length;

      if (avgInterval >= 5 && avgInterval <= 10) {
        frequency = 'weekly';
        isRecurring = true;
      } else if (avgInterval >= 11 && avgInterval <= 18) {
        frequency = 'weekly';
        isRecurring = true;
      } else if (avgInterval >= 19 && avgInterval <= 45) {
        frequency = 'monthly';
        isRecurring = true;
      } else if (avgInterval >= 70 && avgInterval <= 110) {
        frequency = 'quarterly';
        isRecurring = true;
      } else if (avgInterval >= 320 && avgInterval <= 410) {
        frequency = 'annual';
        isRecurring = true;
      } else if (isKnownSubscriptionVendor) {
        frequency = 'monthly';
        isRecurring = true;
      }
    } else if (isKnownSubscriptionVendor) {
      frequency = 'monthly';
      isRecurring = true;
    }

    if (!isRecurring) continue;

    const latestTx = txs[txs.length - 1];
    const prevTx = txs.length >= 2 ? txs[txs.length - 2] : undefined;

    const totalAmount = txs.reduce((sum, t) => sum + t.amount, 0);
    const averageAmount = totalAmount / txs.length;
    const lastAmount = latestTx.amount;
    const previousAmount = prevTx ? prevTx.amount : undefined;

    let priceChangePercent: number | undefined;
    let status: Subscription['status'] = 'active';

    if (previousAmount && previousAmount > 0) {
      const change = ((lastAmount - previousAmount) / previousAmount) * 100;
      if (Math.abs(change) > 5) {
        priceChangePercent = Math.round(change * 10) / 10;
        if (change > 10) {
          status = 'price_increased';
        }
      }
    }

    // Calculate the next upcoming renewal date relative to current time
    const now = new Date();
    const lastDate = new Date(latestTx.date);
    let nextDate = new Date(lastDate);

    // Get billing day of month
    const billingDay = !isNaN(lastDate.getUTCDate()) ? lastDate.getUTCDate() : 1;

    if (frequency === 'weekly') {
      const targetDayOfWeek = lastDate.getUTCDay();
      nextDate = new Date(now);
      const currentDayOfWeek = now.getUTCDay();
      let daysAhead = (targetDayOfWeek - currentDayOfWeek + 7) % 7;
      if (daysAhead === 0) daysAhead = 7;
      nextDate.setUTCDate(now.getUTCDate() + daysAhead);
    } else if (frequency === 'monthly') {
      // Find next occurrence of billingDay
      nextDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), billingDay));
      if (nextDate.getTime() <= now.getTime()) {
        nextDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, billingDay));
      }
    } else if (frequency === 'quarterly') {
      nextDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), billingDay));
      while (nextDate.getTime() <= now.getTime()) {
        nextDate.setUTCMonth(nextDate.getUTCMonth() + 3);
      }
    } else if (frequency === 'annual') {
      nextDate = new Date(Date.UTC(now.getUTCFullYear(), lastDate.getUTCMonth(), billingDay));
      if (nextDate.getTime() <= now.getTime()) {
        nextDate.setUTCFullYear(now.getUTCFullYear() + 1);
      }
    }

    const nextEstimatedDate = !isNaN(nextDate.getTime())
      ? nextDate.toISOString().split('T')[0]
      : latestTx.date;

    const confidence: Subscription['confidence'] =
      txs.length >= 2 ? 'recurrence_detected' : 'candidate_observed_once';
    const isEstimatedDate = true;

    subscriptions.push({
      id: `sub_${group.cleanMerchant.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      cleanMerchant: group.cleanMerchant,
      frequency,
      averageAmount,
      lastAmount,
      previousAmount,
      priceChangePercent,
      lastBilledDate: latestTx.date,
      nextEstimatedDate,
      category: latestTx.category?.[0] || 'Software & Services',
      accountName: latestTx.accountName,
      accountId: latestTx.accountId,
      status,
      transactionCount: txs.length,
      confidence,
      isEstimatedDate,
    });
  }

  // Calculate monthly run rate
  let monthlyRunRate = 0;
  for (const sub of subscriptions) {
    if (sub.frequency === 'weekly') monthlyRunRate += sub.lastAmount * 4.33;
    else if (sub.frequency === 'monthly') monthlyRunRate += sub.lastAmount;
    else if (sub.frequency === 'quarterly') monthlyRunRate += sub.lastAmount / 3;
    else if (sub.frequency === 'annual') monthlyRunRate += sub.lastAmount / 12;
  }

  const annualRunRate = monthlyRunRate * 12;

  // Sort by monthly impact descending
  subscriptions.sort((a, b) => b.lastAmount - a.lastAmount);

  return {
    subscriptions,
    monthlyRunRate,
    annualRunRate,
  };
}

function isKnownSubscriptionMerchant(name: string): boolean {
  const lower = name.toLowerCase();
  const known = [
    'amazon web services',
    'aws',
    'google workspace',
    'gsuite',
    'github',
    'slack',
    'figma',
    'notion',
    'zoom',
    'hubspot',
    'quickbooks',
    'wework',
    'openai',
    'chatgpt',
    'linear',
    'datadog',
    'atlassian',
    'adobe',
    'mailchimp',
    'loom',
    'paypal',
    'canva',
    'shopify',
    'stripe',
    'anthropic',
    'midjourney',
    'miro',
    'clickup',
    'jira',
    'squarespace',
    'godaddy',
    'dropbox',
    'webflow',
    'intuit',
    'xero',
    'microsoft',
    'apple',
    'tasklet',
    'payroll',
    'gusto',
    'rippling',
  ];
  if (known.some((k) => lower.includes(k))) return true;

  const recurringKeywords = [
    'sub',
    'recurring',
    'membership',
    'monthly',
    'annual',
    'plan',
    'software',
    'license',
    'hosting',
    'service',
  ];
  return recurringKeywords.some((kw) => lower.includes(kw));
}
