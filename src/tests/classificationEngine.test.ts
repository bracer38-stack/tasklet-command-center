import { describe, it, expect } from 'vitest';
import { classifyTransaction } from '../services/classificationEngine';
import { cleanMerchantName } from '../services/normalization';
import { detectAnomalies } from '../services/anomalyEngine';
import { Account, Transaction } from '../types';

function makeTx(description: string, amount = 25): Transaction {
  return {
    id: `tx_${description}`,
    accountId: 'acc_test',
    accountName: 'Test Account',
    institution: 'Test Bank',
    date: '2026-10-01',
    rawDescription: description,
    merchantName: description,
    cleanMerchant: cleanMerchantName(description),
    amount,
    currency: 'USD',
    pending: false,
    category: [],
    classification: 'needs_review',
    auditTrail: [],
    anomalies: [],
  };
}

describe('classification keyword matching uses word boundaries', () => {
  it.each([
    ['AWS EMEA', 'business'],
    ['Amazon Web Services', 'business'],
    ['GITHUB.COM', 'business'],
    ['SQ *ZOOM.US', 'business'],
    ['DISNEY+ SUBSCRIPTION', 'personal'],
    ['DISNEY PLUS', 'personal'],
    ["TRADER JOE'S #552", 'personal'],
  ])('matches whole keyword in "%s"', (description, expected) => {
    expect(classifyTransaction(makeTx(description)).classification).toBe(expected);
  });

  it.each([
    'SHAWS SUPERMARKET',
    'LAWSON STATION',
    'PAWS PET SUPPLY',
    'SLACKLINE OUTFITTERS',
    'BIGZOOMER TOYS',
    'BILINEAR LABS',
    'DISNEYLAND RESORT',
  ])('does not match keyword fragments inside "%s"', (description) => {
    expect(classifyTransaction(makeTx(description)).classification).toBe('needs_review');
  });
});

describe('merchant brand normalization uses word boundaries', () => {
  it.each([
    ['AMAZON WEB SERVICES AWS.AMAZON.COM WA', 'Amazon Web Services'],
    ['AWS EMEA', 'Amazon Web Services'],
    ['GOOGLE *WORKSPACE G.CO/HELPPAY#', 'Google Workspace'],
    ['SQ *ZOOM.US', 'Zoom Video'],
    ['UBER EATS 8005928996', 'Uber Eats'],
    ['UBER *TRIP', 'Uber'],
  ])('normalizes "%s" to %s', (raw, expected) => {
    expect(cleanMerchantName(raw)).toBe(expected);
  });

  it.each(['SHAWS SUPERMARKET', 'PAWS PET SUPPLY', 'LAWSON STATION', 'TUBERS FARM STAND'])(
    'does not map "%s" to a known brand',
    (raw) => {
      expect(cleanMerchantName(raw)).toBe(
        raw.split(' ').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
      );
    }
  );
});

describe('anomaly keyword checks use word boundaries', () => {
  const account = (isBusiness: boolean): Account => ({
    id: 'acc_test',
    name: isBusiness ? 'Business Checking' : 'Personal Card',
    officialName: 'Test',
    institution: 'Test Bank',
    mask: '0000',
    type: isBusiness ? 'depository' : 'credit',
    subtype: isBusiness ? 'checking' : 'credit_card',
    currentBalance: 0,
    availableBalance: null,
    currency: 'USD',
    lastSyncedAt: new Date().toISOString(),
    isStale: false,
    isBusiness,
    status: 'active',
  });
  const anomalyTypes = (tx: Transaction, isBusiness: boolean) =>
    detectAnomalies([tx], [account(isBusiness)])[0].anomalies.map((a) => a.type);

  it('flags real work vendors on a personal card but not lookalike merchants', () => {
    expect(anomalyTypes(makeTx('AWS EMEA'), false)).toContain('classification_anomaly');
    expect(anomalyTypes(makeTx('SHAWS SUPERMARKET'), false)).not.toContain('classification_anomaly');
    expect(anomalyTypes(makeTx('PAWS PET SUPPLY'), false)).not.toContain('classification_anomaly');
  });

  it('still matches keywords ending in punctuation such as disney+', () => {
    const tx = { ...makeTx('DISNEY+ SUBSCRIPTION'), classification: 'business' as const };
    expect(anomalyTypes(tx, true)).toContain('classification_anomaly');
  });
});
