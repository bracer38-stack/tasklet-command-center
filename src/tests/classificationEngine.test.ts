import { describe, it, expect } from 'vitest';
import { classifyTransaction } from '../services/classificationEngine';
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
    cleanMerchant: description,
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
