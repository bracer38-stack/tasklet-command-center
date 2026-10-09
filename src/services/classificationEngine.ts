import { Account, AuditTrailEntry, Transaction, TransactionClassification } from '../types';

interface PatternRule {
  id: string;
  name: string;
  pattern: RegExp;
  classification: TransactionClassification;
  confidence: number;
  reasoning: string;
}

const TAXONOMY_RULES: PatternRule[] = [
  // Income
  {
    id: 'rule_income_stripe',
    name: 'Stripe Payout Rule',
    pattern: /stripe\s*payout|stripe\s*payments/i,
    classification: 'income',
    confidence: 0.99,
    reasoning: 'Merchant matches Stripe payment gateway processor payouts.',
  },
  {
    id: 'rule_income_client_wire',
    name: 'Client Wire Deposit',
    pattern: /client\s*wire|customer\s*deposit|invoice\s*pymt|ach\s*credit\s*client/i,
    classification: 'income',
    confidence: 0.95,
    reasoning: 'Customer invoice payment or inbound wire received.',
  },
  // Debt Payments
  {
    id: 'rule_debt_sba',
    name: 'SBA Loan Installment Rule',
    pattern: /sba\s*loan|eidl\s*payment|commercial\s*loan\s*pmt/i,
    classification: 'debt_payment',
    confidence: 0.98,
    reasoning: 'Fixed principal/interest installment for SBA commercial term loan.',
  },
  {
    id: 'rule_debt_card_pmt',
    name: 'Credit Card Bill Payment',
    pattern: /autopay\s*amex|chase\s*credit\s*crd\s*epay|capital\s*one\s*autopay|card\s*payment/i,
    classification: 'debt_payment',
    confidence: 0.98,
    reasoning: 'Settlement of revolving credit card statement balance.',
  },
  // Business Operating Expenses
  {
    id: 'rule_biz_payroll',
    name: 'Payroll & Benefits Rule',
    pattern: /gusto\s*payroll|rippling|adp\s*total|paychex/i,
    classification: 'business',
    confidence: 0.99,
    reasoning: 'Certified business payroll, tax withholding, and employee benefits disbursement.',
  },
  {
    id: 'rule_biz_cloud',
    name: 'Cloud Infrastructure Rule',
    pattern: /amazon\s*web\s*services|aws|google\s*cloud|azure|digitalocean|cloudflare|vercel/i,
    classification: 'business',
    confidence: 0.99,
    reasoning: 'Core SaaS/cloud production server infrastructure expense.',
  },
  {
    id: 'rule_biz_productivity',
    name: 'Team Productivity & Software Rule',
    pattern: /google\s*workspace|github|slack|figma|notion|hubspot|zoom|quickbooks|linear/i,
    classification: 'business',
    confidence: 0.98,
    reasoning: 'Essential software tooling and corporate SaaS subscription.',
  },
  {
    id: 'rule_biz_office',
    name: 'Workspace & Rent Rule',
    pattern: /wework|industrious|regus|commercial\s*properties|office\s*lease/i,
    classification: 'business',
    confidence: 0.97,
    reasoning: 'Physical commercial office facilities and coworking rent.',
  },
  {
    id: 'rule_biz_travel',
    name: 'Business Travel Rule',
    pattern: /delta\s*air|united\s*airlines|american\s*airlines|marriott|hilton|hyatt/i,
    classification: 'business',
    confidence: 0.88,
    reasoning: 'Commercial airline or hotel stay during business operations.',
  },
  // Personal
  {
    id: 'rule_pers_entertainment',
    name: 'Personal Entertainment Rule',
    pattern: /steam\s*games|playstation|nintendo|netflix|spotify\s*personal|disney\+/i,
    classification: 'personal',
    confidence: 0.98,
    reasoning: 'Consumer digital media and personal gaming entertainment.',
  },
  {
    id: 'rule_pers_groceries',
    name: 'Personal Groceries Rule',
    pattern: /trader\s*joe|whole\s*foods|safeway|kroger|costco\s*wholesale/i,
    classification: 'personal',
    confidence: 0.92,
    reasoning: 'Consumer household food and supermarket provisioning.',
  },
];

export function classifyTransaction(
  tx: Transaction,
  account?: Account
): {
  classification: TransactionClassification;
  auditEntry: AuditTrailEntry;
} {
  const timestamp = new Date().toISOString();

  // 1. If already overridden by user, maintain override
  const existingOverride = tx.auditTrail.find((a) => a.userOverridden);
  if (existingOverride) {
    return {
      classification: tx.classification,
      auditEntry: {
        id: `audit_${Date.now()}_${tx.id}`,
        timestamp,
        assignedClassification: tx.classification,
        ruleApplied: 'User Manual Override (Enforced)',
        confidence: 1.0,
        reasoning: `Maintained user override: Classified manually by owner.`,
        userOverridden: true,
      },
    };
  }

  // 2. Internal Transfer
  if (tx.isTransferCounterpart) {
    if (tx.isCreditCardPayment) {
      return {
        classification: 'debt_payment',
        auditEntry: {
          id: `audit_${Date.now()}_${tx.id}`,
          timestamp,
          assignedClassification: 'debt_payment',
          ruleApplied: 'Credit Card Payment Detector',
          confidence: 0.98,
          reasoning: `Matched payment between checking and credit card account. Excluded from business P&L expenses.`,
          userOverridden: false,
        },
      };
    }
    return {
      classification: 'transfer',
      auditEntry: {
        id: `audit_${Date.now()}_${tx.id}`,
        timestamp,
        assignedClassification: 'transfer',
        ruleApplied: 'Internal Transfer Pair Matching',
        confidence: 0.96,
        reasoning: `Counterpart transfer transaction linked (#${tx.transferCounterpartId}). Excluded from revenue and expenses.`,
        userOverridden: false,
      },
    };
  }

  // 3. Taxonomy & Pattern Rules
  const searchText = `${tx.rawDescription} ${tx.merchantName} ${tx.cleanMerchant}`.toLowerCase();
  for (const rule of TAXONOMY_RULES) {
    if (rule.pattern.test(searchText)) {
      // Inflow check for revenue
      if (rule.classification === 'income' && tx.amount > 0) {
        continue; // Income must be an inflow
      }

      return {
        classification: rule.classification,
        auditEntry: {
          id: `audit_${Date.now()}_${tx.id}`,
          timestamp,
          assignedClassification: rule.classification,
          ruleApplied: rule.name,
          confidence: rule.confidence,
          reasoning: rule.reasoning,
          userOverridden: false,
        },
      };
    }
  }

  // 4. Inflow fallback
  if (tx.amount < 0) {
    return {
      classification: 'needs_review',
      auditEntry: {
        id: `audit_${Date.now()}_${tx.id}`,
        timestamp,
        assignedClassification: 'needs_review',
        ruleApplied: 'Unverified Inflow Quarantine',
        confidence: 0.5,
        reasoning: `Inbound credit of $${Math.abs(tx.amount).toFixed(2)} on "${account?.name || 'Account'}" requires owner verification to differentiate customer revenue from capital contributions or loans.`,
        userOverridden: false,
      },
    };
  }

  // 5. Strict Zero-Guessing Policy for Unmatched Outflows
  // Never guess 'business' or 'personal' without explicit rule evidence.
  return {
    classification: 'needs_review',
    auditEntry: {
      id: `audit_${Date.now()}_${tx.id}`,
      timestamp,
      assignedClassification: 'needs_review',
      ruleApplied: 'Unverified Transaction Quarantine (Zero Guessing)',
      confidence: 0.45,
      reasoning: `No verified vendor rule matched "${tx.cleanMerchant}". Placed in Needs Review rather than guessing classification, preventing P&L and tax distortion.`,
      userOverridden: false,
    },
  };
}

export function reclassifyTransaction(
  tx: Transaction,
  newClassification: TransactionClassification,
  reasoning: string = 'Owner manual verification via Command Center',
  actor: string = 'Owner / Manual Review'
): Transaction {
  const timestamp = new Date().toISOString();
  const prior = tx.classification;

  const newAudit: AuditTrailEntry = {
    id: `audit_${Date.now()}_override`,
    timestamp,
    assignedClassification: newClassification,
    ruleApplied: 'Manual Owner Action',
    confidence: 1.0,
    reasoning,
    userOverridden: true,
    priorClassification: prior,
    previousValue: prior,
    newValue: newClassification,
    actor,
    canRevert: true,
  };

  const updatedAnomalies =
    newClassification === 'personal' || newClassification === 'business' || newClassification === 'reimbursement'
      ? (tx.anomalies || []).filter((a) => a.type !== 'classification_anomaly')
      : tx.anomalies;

  return {
    ...tx,
    classification: newClassification,
    entity: newClassification === 'personal' ? 'personal' : (newClassification === 'business' ? 'business' : tx.entity),
    anomalies: updatedAnomalies,
    auditTrail: [newAudit, ...(tx.auditTrail || [])],
  };
}

export function revertTransactionClassification(tx: Transaction): Transaction {
  if (!tx.auditTrail || tx.auditTrail.length === 0) return tx;

  // Find the most recent manual override that has a prior classification
  const overrideEntry = tx.auditTrail.find((a) => a.userOverridden && a.priorClassification);
  if (!overrideEntry || !overrideEntry.priorClassification) return tx;

  const targetClassification = overrideEntry.priorClassification;

  const revertAudit: AuditTrailEntry = {
    id: `audit_${Date.now()}_revert`,
    timestamp: new Date().toISOString(),
    assignedClassification: targetClassification,
    ruleApplied: 'Manual Action Reverted',
    confidence: 1.0,
    reasoning: `Reverted previous manual classification ('${tx.classification}') back to original state '${targetClassification}'.`,
    userOverridden: false,
    previousValue: tx.classification,
    newValue: targetClassification,
    actor: 'Owner / Revert Action',
    canRevert: false,
  };

  return {
    ...tx,
    classification: targetClassification,
    auditTrail: [revertAudit, ...tx.auditTrail],
  };
}
