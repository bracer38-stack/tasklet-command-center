import { Account, MetricLineage, Subscription, Transaction, UpcomingObligation } from '../types';
import { formatCurrency, formatPercent } from './normalization';
import { calculateOperatingExpenses, calculateOperatingRevenue } from './transferEngine';

/**
 * Metric Lineage & Provenance Engine.
 * Answers "Why does this number say $X?" for every financial metric and balance.
 * Traces every figure back to exact source records, equations, and intermediate filters.
 */

export function deriveMetricLineage(
  metricKey: string,
  accounts: Account[],
  transactions: Transaction[],
  subscriptions: Subscription[] = [],
  upcomingObligations: UpcomingObligation[] = []
): MetricLineage | null {
  switch (metricKey) {
    case 'true_available_cash': {
      const depositoryAccounts = accounts.filter((a) => a.type === 'depository');
      const totalBookCash = depositoryAccounts.reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);

      const pendingOutflows = transactions
        .filter((t) => t.pending && t.amount > 0)
        .map((t) => ({
          id: t.id,
          label: `${t.cleanMerchant} (${t.accountName})`,
          amount: t.amount,
          detail: `Pending hold authorized on ${t.date}`,
        }));

      const totalPendingOutflows = pendingOutflows.reduce((sum, p) => sum + p.amount, 0);

      const obligationsList = upcomingObligations.map((o) => ({
        id: o.id,
        label: `${o.name} (${o.accountName})`,
        amount: o.amount,
        detail: `Due on ${o.dueDate} (${o.type.replace('_', ' ')})`,
      }));

      const totalObligations = obligationsList.reduce((sum, o) => sum + o.amount, 0);
      const availableCash = Math.max(0, totalBookCash - totalPendingOutflows - totalObligations);

      return {
        metricKey,
        metricName: 'True Available Cash',
        finalValue: availableCash.toFixed(2),
        formattedValue: formatCurrency(availableCash),
        formula: 'Depository Book Cash - Pending Outflow Holds - 7-Day Committed Obligations',
        explanation:
          'Represents your true unencumbered liquidity available for immediate withdrawal or payroll, preventing overdrafts from authorized holds and imminent bills.',
        components: [
          {
            name: '1. Depository Book Balances (+)',
            value: totalBookCash,
            operation: 'add',
            sourceType: 'account_balance',
            evidence: depositoryAccounts.map((a) => ({
              id: a.id,
              label: `${a.name} (${a.institution} ••${a.mask})`,
              amount: a.currentBalance,
              detail: `Source balance as of ${new Date(a.lastSyncedAt).toLocaleTimeString()}`,
            })),
          },
          {
            name: '2. Pending Authorized Holds (-)',
            value: totalPendingOutflows,
            operation: 'subtract',
            sourceType: 'pending_hold',
            evidence: pendingOutflows,
          },
          {
            name: '3. Next 7-Day Committed Obligations (-)',
            value: totalObligations,
            operation: 'subtract',
            sourceType: 'obligation',
            evidence: obligationsList,
          },
        ],
      };
    }

    case 'total_book_cash': {
      const depositoryAccounts = accounts.filter((a) => a.type === 'depository');
      const total = depositoryAccounts.reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);

      return {
        metricKey,
        metricName: 'Total Settled / Book Cash',
        finalValue: total.toFixed(2),
        formattedValue: formatCurrency(total),
        formula: 'Sum of current settled balances across all depository checking & savings accounts',
        explanation:
          'Gross book balance reported by connected bank feeds. Does not factor in pending pre-authorizations or upcoming vendor obligations.',
        components: [
          {
            name: 'Connected Depository Accounts',
            value: total,
            operation: 'base',
            sourceType: 'account_balance',
            evidence: depositoryAccounts.map((a) => ({
              id: a.id,
              label: `${a.name} (${a.institution})`,
              amount: a.currentBalance,
              detail: `Account type: ${a.subtype}, Last sync: ${new Date(a.lastSyncedAt).toLocaleString()}`,
            })),
          },
        ],
      };
    }

    case 'revolving_credit_debt': {
      const creditAccounts = accounts.filter((a) => a.type === 'credit');
      const totalDebt = creditAccounts.reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);

      return {
        metricKey,
        metricName: 'Total Revolving Credit Debt',
        finalValue: totalDebt.toFixed(2),
        formattedValue: formatCurrency(totalDebt),
        formula: 'Sum of posted current balances across all commercial and personal credit cards',
        explanation:
          'Aggregated outstanding credit card liability across all cards. Excludes commercial term loans which are tracked separately.',
        components: [
          {
            name: 'Credit Card Balances',
            value: totalDebt,
            operation: 'base',
            sourceType: 'account_balance',
            evidence: creditAccounts.map((a) => ({
              id: a.id,
              label: `${a.name} (${a.institution} ••${a.mask})`,
              amount: a.currentBalance,
              detail: `Limit: ${formatCurrency(a.creditLimit || 0)}, APR: ${a.interestRate || 'N/A'}%`,
            })),
          },
        ],
      };
    }

    case 'blended_utilization': {
      const creditAccounts = accounts.filter((a) => a.type === 'credit');
      const totalDebt = creditAccounts.reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);
      const totalLimit = creditAccounts.reduce((sum, a) => sum + (a.creditLimit || 0), 0);
      const util = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;

      return {
        metricKey,
        metricName: 'Blended Credit Utilization Rate',
        finalValue: util.toFixed(1),
        formattedValue: formatPercent(util),
        formula: '(Total Revolving Credit Balance / Total Credit Limit) * 100',
        explanation:
          'Ratio of revolving credit utilized against aggregate borrowing limits. High utilization (>30%) harms business credit ratings and borrowing terms.',
        components: [
          {
            name: 'Numerator: Outstanding Balances',
            value: totalDebt,
            operation: 'base',
            sourceType: 'account_balance',
            evidence: creditAccounts.map((a) => ({
              id: a.id,
              label: a.name,
              amount: a.currentBalance,
              detail: `Card balance`,
            })),
          },
          {
            name: 'Denominator: Approved Credit Lines',
            value: totalLimit,
            operation: 'divide',
            sourceType: 'credit_limit',
            evidence: creditAccounts.map((a) => ({
              id: a.id,
              label: a.name,
              amount: a.creditLimit || 0,
              detail: `Approved credit limit`,
            })),
          },
        ],
      };
    }

    case 'operating_expenses': {
      const bizTxs = transactions.filter(
        (t) =>
          t.classification === 'business' &&
          t.amount > 0 &&
          !t.isTransferCounterpart &&
          !t.isCreditCardPayment
      );
      const totalExpenses = bizTxs.reduce((sum, t) => sum + t.amount, 0);

      return {
        metricKey,
        metricName: 'True Operating Expenses (P&L)',
        finalValue: totalExpenses.toFixed(2),
        formattedValue: formatCurrency(totalExpenses),
        formula: 'Sum of verified business charges strictly excluding internal transfers and credit card payments',
        explanation:
          'Clean operational deductions. Transfer movements and credit card payments are excluded to prevent duplicate expense recording.',
        components: [
          {
            name: 'Deductible Operating Expenses',
            value: totalExpenses,
            operation: 'add',
            sourceType: 'transaction_sum',
            evidence: bizTxs.map((t) => ({
              id: t.id,
              label: `${t.cleanMerchant} (${t.date})`,
              amount: t.amount,
              detail: `${t.accountName} • ${t.category?.[0] || 'Expense'}`,
            })),
          },
        ],
      };
    }

    case 'operating_revenue': {
      const revenue = calculateOperatingRevenue(transactions);
      const revTxs = transactions.filter(
        (t) => t.classification === 'income' && t.amount < 0 && !t.isTransferCounterpart
      );

      return {
        metricKey,
        metricName: 'Gross Operating Revenue',
        finalValue: revenue.toFixed(2),
        formattedValue: formatCurrency(revenue),
        formula: 'Sum of customer invoices and merchant payouts, excluding inbound transfers',
        explanation:
          'Gross earned receipts. Transfer deposits from your own checking/savings accounts are excluded to prevent phantom revenue.',
        components: [
          {
            name: 'Customer & Processor Inflows',
            value: revenue,
            operation: 'add',
            sourceType: 'transaction_sum',
            evidence: revTxs.map((t) => ({
              id: t.id,
              label: `${t.cleanMerchant} (${t.date})`,
              amount: Math.abs(t.amount),
              detail: `${t.accountName} • Inbound credit`,
            })),
          },
        ],
      };
    }

    case 'monthly_burn_rate': {
      let monthlyRunRate = 0;
      for (const sub of subscriptions) {
        if (sub.frequency === 'weekly') monthlyRunRate += sub.lastAmount * 4.33;
        else if (sub.frequency === 'monthly') monthlyRunRate += sub.lastAmount;
        else if (sub.frequency === 'quarterly') monthlyRunRate += sub.lastAmount / 3;
        else if (sub.frequency === 'annual') monthlyRunRate += sub.lastAmount / 12;
      }

      return {
        metricKey,
        metricName: 'Monthly Recurring Software & Fixed Burn',
        finalValue: monthlyRunRate.toFixed(2),
        formattedValue: `${formatCurrency(monthlyRunRate)}/mo`,
        formula: 'Sum of normalized monthly cost across all detected software subscriptions & fixed leases',
        explanation:
          'Normalized monthly run rate of committed software licenses, coworking leases, and recurring utility bills.',
        components: [
          {
            name: 'Active Recurring Subscriptions',
            value: monthlyRunRate,
            operation: 'add',
            sourceType: 'transaction_sum',
            evidence: subscriptions.map((s) => ({
              id: s.id,
              label: `${s.cleanMerchant} (${s.frequency})`,
              amount: s.lastAmount,
              detail: `Category: ${s.category}, Billed to: ${s.accountName}`,
            })),
          },
        ],
      };
    }

    default:
      return null;
  }
}
