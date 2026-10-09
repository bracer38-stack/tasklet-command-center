import { describe, it, expect } from 'vitest';
import { classifyTransaction } from '../services/classificationEngine';
import { cleanMerchantName } from '../services/normalization';
import { Transaction } from '../types';

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
