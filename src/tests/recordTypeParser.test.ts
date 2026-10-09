import { describe, it, expect } from 'vitest';
import {
  parseRecordTypeContent,
  generateSampleRecordTypeCsv,
} from '../services/recordTypeParser';

describe('recordTypeParser Universal Multi-Record-Type Pipeline', () => {
  it('correctly partitions rows by record_type into isolated state buckets', () => {
    const csvData = generateSampleRecordTypeCsv();
    const summary = parseRecordTypeContent(csvData);

    expect(summary.rowsRead).toBe(7);
    expect(summary.rejectedCount).toBe(0);
    expect(summary.acceptedCount).toBe(7);
    expect(summary.duplicatesSkippedCount).toBe(0);
    expect(summary.unknownRecordTypesCount).toBe(0);

    // Totals by record type
    expect(summary.totalsByRecordType.account_snapshot).toBe(2);
    expect(summary.totalsByRecordType.loan).toBe(1);
    expect(summary.totalsByRecordType.bill).toBe(1);
    expect(summary.totalsByRecordType.transaction).toBe(2);
    expect(summary.totalsByRecordType.notes_assumptions).toBe(1);

    // Ledger transactions
    expect(summary.parsedTransactions.length).toBe(2);
    expect(summary.parsedTransactions[0].id).toBe('tx_vendor_001');
    expect(summary.parsedTransactions[0].amount).toBe(210.0);
    expect(summary.parsedTransactions[0].classification).toBe('needs_review'); // Requirement 9: Default unclassified to Needs Review

    // Preserved negative inflow amount sign (Requirement 6)
    expect(summary.parsedTransactions[1].id).toBe('tx_vendor_002');
    expect(summary.parsedTransactions[1].amount).toBe(-15000.0);
    expect(summary.parsedTransactions[1].classification).toBe('needs_review');

    // Accounts snapshot only - never creates transactions (Requirement 4)
    expect(summary.parsedAccounts.length).toBe(2);
    expect(summary.parsedAccounts[0].id).toBe('acc_chase_op');
    expect(summary.parsedAccounts[0].currentBalance).toBe(54250.0);
    expect(summary.parsedAccounts[1].id).toBe('acc_amex_biz');

    // Loans only (Requirement 4)
    expect(summary.parsedLoans.length).toBe(1);
    expect(summary.parsedLoans[0].id).toBe('loan_sba_01');
    expect(summary.parsedLoans[0].type).toBe('loan');
    expect(summary.parsedLoans[0].currentBalance).toBe(85000.0);
    expect(summary.parsedLoans[0].interestRate).toBe(6.25);
    expect(summary.parsedLoans[0].monthlyPayment).toBe(1420.0);

    // Bills only (Requirement 4)
    expect(summary.parsedBills.length).toBe(1);
    expect(summary.parsedBills[0].averageAmount).toBe(2850.0);

    // Notes only (Requirement 4)
    expect(summary.parsedNotes.length).toBe(1);
    expect(summary.parsedNotes[0].noteText).toContain('Q4 revenue forecast');
  });

  it('rejects transaction records missing transaction_id (Requirement 5)', () => {
    const invalidTxCsv = `record_type,transaction_id,amount,description
transaction,,450.00,Office Supplies`;
    const summary = parseRecordTypeContent(invalidTxCsv);

    expect(summary.rowsRead).toBe(1);
    expect(summary.acceptedCount).toBe(0);
    expect(summary.rejectedCount).toBe(1);
    expect(summary.rejections[0].reason).toContain('Missing required unique "transaction_id"');
  });

  it('detects and skips duplicate transaction_id values without crashing', () => {
    const existingTxIds = new Set(['tx_existing_999']);
    const duplicateCsv = `record_type,transaction_id,amount,description
transaction,tx_existing_999,100.00,Already Imported
transaction,tx_new_001,200.00,Fresh Outflow
transaction,tx_new_001,200.00,Same In File Duplicate`;

    const summary = parseRecordTypeContent(duplicateCsv, { existingTransactionIds: existingTxIds });

    expect(summary.rowsRead).toBe(3);
    expect(summary.acceptedCount).toBe(1);
    expect(summary.duplicatesSkippedCount).toBe(2);
    expect(summary.duplicates.length).toBe(2);
    expect(summary.parsedTransactions.length).toBe(1);
    expect(summary.parsedTransactions[0].id).toBe('tx_new_001');
  });

  it('flags unknown record types and logs them in summary (Requirement 7)', () => {
    const mixedCsv = `record_type,id,amount,name
arbitrary_type,123,50,Test Row
transaction,tx_valid_01,85,Valid Outflow`;

    const summary = parseRecordTypeContent(mixedCsv);

    expect(summary.unknownRecordTypesCount).toBe(1);
    expect(summary.unknownTypes[0].rawType).toBe('arbitrary_type');
    expect(summary.rejectedCount).toBe(1);
    expect(summary.acceptedCount).toBe(1);
  });

  it('parses JSON format payloads by record_type as well', () => {
    const jsonPayload = JSON.stringify([
      {
        record_type: 'account_snapshot',
        account_id: 'acc_mercury_test',
        name: 'Mercury Test Op',
        institution: 'Mercury',
        type: 'depository',
        balance: 75000,
      },
      {
        record_type: 'transaction',
        transaction_id: 'tx_json_01',
        amount: 320.5,
        description: 'Figma Subscription',
        classification: 'business',
      },
      {
        record_type: 'notes_assumptions',
        id: 'note_json_01',
        note_text: 'Assuming 10% month-over-month growth.',
      },
    ]);

    const summary = parseRecordTypeContent(jsonPayload);

    expect(summary.rowsRead).toBe(3);
    expect(summary.acceptedCount).toBe(3);
    expect(summary.totalsByRecordType.account_snapshot).toBe(1);
    expect(summary.totalsByRecordType.transaction).toBe(1);
    expect(summary.totalsByRecordType.notes_assumptions).toBe(1);
    expect(summary.parsedTransactions[0].classification).toBe('business');
  });

  it('enforces separate tables: never leaks account balances, loans, or bills into the transaction ledger (Mandates 2 & 3)', () => {
    const mixedPayload = `record_type,id,name,amount,balance,due_date
account_snapshot,acc_boa_chk,Bank of America Checking,,12500.00,
loan,loan_equip,Equipment Loan,,45000.00,
bill,sub_aws,AWS Cloud,420.00,,2026-10-15
transaction,tx_vendor_gas,Chevron,65.00,,
notes_assumptions,note_01,Tax season review note,,,`;

    const summary = parseRecordTypeContent(mixedPayload);

    expect(summary.parsedTransactions.length).toBe(1);
    expect(summary.parsedTransactions[0].id).toBe('tx_vendor_gas');
    expect(summary.parsedTransactions[0].amount).toBe(65.00);

    // Verified separate tables
    expect(summary.parsedAccounts.length).toBe(1);
    expect(summary.parsedAccounts[0].id).toBe('acc_boa_chk');
    expect(summary.parsedAccounts[0].currentBalance).toBe(12500.00);

    expect(summary.parsedLoans.length).toBe(1);
    expect(summary.parsedLoans[0].id).toBe('loan_equip');
    expect(summary.parsedLoans[0].currentBalance).toBe(45000.00);

    expect(summary.parsedBills.length).toBe(1);
    expect(summary.parsedBills[0].id).toBe('sub_aws');

    expect(summary.parsedNotes.length).toBe(1);
    expect(summary.parsedNotes[0].id).toBe('note_01');
  });

  it('computes exact zero-variance comparison between raw source totals and staged totals (Mandate 7)', () => {
    const rawCsv = `date,transaction_id,account_id,description,amount,status
2026-10-01,tx_01,acc_op,Client Invoice Payment,-5000.00,posted
2026-10-02,tx_02,acc_op,Gusto Payroll,3200.50,posted
2026-10-03,tx_03,acc_op,Coffee Shop,14.75,pending`;

    const summary = parseRecordTypeContent(rawCsv);

    expect(summary.acceptedCount).toBe(3);
    expect(summary.variance).toBeDefined();
    // Raw vs Staged debit/credit match exactly:
    expect(summary.variance!.rawDebits).toBe(3215.25);
    expect(summary.variance!.stagedDebits).toBe(3215.25);
    expect(summary.variance!.deltaDebits).toBe(0.00);

    expect(summary.variance!.rawCredits).toBe(5000.00);
    expect(summary.variance!.stagedCredits).toBe(5000.00);
    expect(summary.variance!.deltaCredits).toBe(0.00);
  });

  it('normalizes status explicitly to posted, pending, or unknown (Mandate 5)', () => {
    const statusCsv = `transaction_id,account_id,amount,description,status
tx_p1,acc_op,100.00,Cleared Wire,posted
tx_p2,acc_op,55.00,Card Swipe Pending,pending
tx_p3,acc_op,40.00,Uncertain Feed Item,authorized
tx_p4,acc_op,20.00,Legacy Format,`;

    const summary = parseRecordTypeContent(statusCsv);

    expect(summary.parsedTransactions[0].status).toBe('posted');
    expect(summary.parsedTransactions[0].pending).toBe(false);

    expect(summary.parsedTransactions[1].status).toBe('pending');
    expect(summary.parsedTransactions[1].pending).toBe(true);

    expect(summary.parsedTransactions[2].status).toBe('pending'); // 'authorized' maps to pending
    expect(summary.parsedTransactions[2].pending).toBe(true);

    expect(summary.parsedTransactions[3].status).toBe('unknown');
    expect(summary.parsedTransactions[3].pending).toBe(false);
  });

  it('never creates duplicates from identical text descriptions when source IDs differ (Mandate 4)', () => {
    const identicalTextCsv = `transaction_id,account_id,amount,description,date
tx_real_1,acc_op,12.50,Starbucks Coffee,2026-10-01
tx_real_2,acc_op,12.50,Starbucks Coffee,2026-10-01`;

    const summary = parseRecordTypeContent(identicalTextCsv);

    // Both distinct transactions preserved because source transaction_id differs
    expect(summary.rowsRead).toBe(2);
    expect(summary.acceptedCount).toBe(2);
    expect(summary.duplicatesSkippedCount).toBe(0);
    expect(summary.parsedTransactions.length).toBe(2);
    expect(summary.parsedTransactions[0].id).toBe('tx_real_1');
    expect(summary.parsedTransactions[1].id).toBe('tx_real_2');
  });

  it('correctly accepts and parses credit card master tracker CSVs with balances and limits', () => {
    const cardCsv = `card_name,last_four,reported_balance,reported_available_credit,credit_limit,minimum_payment,due_day_of_month,interest_rate_percent,status_or_usage_notes
BOA Travel Rewards,9000,0.0,1000.0,1000.0,0.0,21,,CubeSmart recurring card charge
Venmo Credit,3710,1217.35,5582.0,6800.0,35.0,15,29.0,Pending $35 Venmo activity
CareCredit,2559,462.0,1038.0,1500.0,30.0,10,,0% promotional financing expires Jan. 18 2027`;

    const summary = parseRecordTypeContent(cardCsv);

    expect(summary.rowsRead).toBe(3);
    expect(summary.acceptedCount).toBe(3);
    expect(summary.rejectedCount).toBe(0);
    expect(summary.parsedAccounts.length).toBe(3);
    expect(summary.parsedAccounts[0].name).toBe('BOA Travel Rewards');
    expect(summary.parsedAccounts[0].mask).toBe('9000');
    expect(summary.parsedAccounts[0].creditLimit).toBe(1000.0);
    expect(summary.parsedAccounts[1].name).toBe('Venmo Credit');
    expect(summary.parsedAccounts[1].currentBalance).toBe(1217.35);
    expect(summary.parsedAccounts[1].interestRate).toBe(29.0);
    expect(summary.parsedAccounts[1].monthlyPayment).toBe(35.0);
    expect(summary.parsedNotes.length).toBe(3);
  });

  it('correctly parses user checking and savings depository CSVs with balances and treatments', () => {
    const bankCsv = `account_name,last_four,account_type,reported_current_balance,reported_available_balance,last_updated,connection_status,data_freshness_status,low_balance_threshold,household_cash_treatment,account_notes
WSFS Checking #6195,,checking,706.6,706.6,"October 3, 2026",connected,source snapshot,500.0,Included in household cash snapshot; not free spending after bills/cash-floor reserves,WSFS direct checking
BOA Checking #4488 (Personal Checking),,checking,3845.63,3786.06,"October 3, 2026",connected,source snapshot,300.0,Included in household cash snapshot; not free spending after bills/cash-floor reserves,BOA personal checking
Savings #4462 (Team Rhino),,savings,2260.28,2260.28,"October 3, 2026",connected,source snapshot,500.0,Business inventory/operations capital; excluded from household cash and income,Team Rhino business inventory capital
APG FCU Savings #3019,,savings,12353.5,739.4,"October 3, 2026",connected,source snapshot,0.0,Restricted/pledged collateral; excluded from ordinary household cash,Most funds pledged as loan collateral
EverBank Savings #5275,,savings,51.06,,"June 29, 2026 (stale — login required)",not connected / login required or manual,stale/login required or not currently connected,0.0,Stale disconnected; do not treat as current cash,Plaid login expired`;

    const summary = parseRecordTypeContent(bankCsv);

    expect(summary.rowsRead).toBe(5);
    expect(summary.acceptedCount).toBe(5);
    expect(summary.rejectedCount).toBe(0);
    expect(summary.parsedAccounts.length).toBe(5);

    // WSFS Checking
    expect(summary.parsedAccounts[0].type).toBe('depository');
    expect(summary.parsedAccounts[0].subtype).toBe('checking');
    expect(summary.parsedAccounts[0].currentBalance).toBe(706.6);
    expect(summary.parsedAccounts[0].availableBalance).toBe(706.6);

    // BOA Checking
    expect(summary.parsedAccounts[1].type).toBe('depository');
    expect(summary.parsedAccounts[1].subtype).toBe('checking');
    expect(summary.parsedAccounts[1].currentBalance).toBe(3845.63);
    expect(summary.parsedAccounts[1].availableBalance).toBe(3786.06);

    // Team Rhino Savings (Business)
    expect(summary.parsedAccounts[2].type).toBe('depository');
    expect(summary.parsedAccounts[2].subtype).toBe('savings');
    expect(summary.parsedAccounts[2].isBusiness).toBe(true);
    expect(summary.parsedAccounts[2].entity).toBe('business');
    expect(summary.parsedAccounts[2].currentBalance).toBe(2260.28);

    // APG FCU Savings (Restricted Collateral)
    expect(summary.parsedAccounts[3].type).toBe('depository');
    expect(summary.parsedAccounts[3].subtype).toBe('savings');
    expect(summary.parsedAccounts[3].currentBalance).toBe(12353.5);
    expect(summary.parsedAccounts[3].availableBalance).toBe(739.4);

    // EverBank (Stale / Login Required)
    expect(summary.parsedAccounts[4].isStale).toBe(true);
    expect(summary.parsedAccounts[4].status).toBe('disconnected');
    expect(summary.parsedAccounts[4].currentBalance).toBe(51.06);

    expect(summary.parsedNotes.length).toBe(5);
  });

  it('correctly parses and reconciles Plaid statement exports with raw_amount, snapshot_date, and True booleans', () => {
    const plaidStatementCsv = `record_type,snapshot_date,account_name,transaction_id,pending,description,raw_amount,normalized_amount,category
transaction,2026-10-05,Adv Relationship Banking,pJReQk5BKwCdDy0PbBV7IkxNdzoPQJTA61687,True,Truist Credit Card Payment,27.0,-27.0,transfers_credit_card_payment
transaction,2026-10-05,Adv Relationship Banking,XAyOKzdJvYHMDo63KQANuQVKmDzBkaizXwXnP,True,Starbucks,13.0,-13.0,dining_drinks_coffee
transaction,2026-10-05,WSFS DIRECT CHECKING,DMRpmqQdj4IoxzN4Qj7acjaQyq6XKYFVR14Ze,True,Zelle to Kimberley Ines,520.0,-520.0,transfers_other_transfer_out
transaction,2026-10-05,Adv Relationship Banking,6a0kApY5MqFYxyvNmLa8Snxw45zERrtAjoj8q,True,Affirm Payment,44.24,-44.24,financial_bnpl_payments`;

    const existingAccounts = [
      {
        id: 'acc_adv_relationship_banking',
        name: 'BOA Checking #4488 (Personal Checking)',
        officialName: 'Bank of America Advantage Relationship Banking',
        institution: 'Bank of America',
        mask: '4488',
        type: 'depository' as const,
        subtype: 'checking' as const,
        currentBalance: 3845.63,
        availableBalance: 3786.06,
        currency: 'USD',
        lastSyncedAt: '2026-10-05T00:00:00Z',
        isStale: false,
        isBusiness: false,
        status: 'active' as const,
      },
      {
        id: 'acc_wsfs_direct_checking',
        name: 'WSFS Checking #6195',
        officialName: 'WSFS Bank Direct Checking',
        institution: 'WSFS',
        mask: '6195',
        type: 'depository' as const,
        subtype: 'checking' as const,
        currentBalance: 706.6,
        availableBalance: 706.6,
        currency: 'USD',
        lastSyncedAt: '2026-10-05T00:00:00Z',
        isStale: false,
        isBusiness: false,
        status: 'active' as const,
      },
    ];

    const summary = parseRecordTypeContent(plaidStatementCsv, { existingAccounts });

    expect(summary.rowsRead).toBe(4);
    expect(summary.acceptedCount).toBe(4);
    expect(summary.rejectedCount).toBe(0);
    expect(summary.duplicatesSkippedCount).toBe(0);
    expect(summary.totalsByRecordType.transaction).toBe(4);

    // Verify transactions
    expect(summary.parsedTransactions.length).toBe(4);

    // 1. Truist Credit Card Payment
    const truist = summary.parsedTransactions[0];
    expect(truist.id).toBe('pJReQk5BKwCdDy0PbBV7IkxNdzoPQJTA61687');
    expect(truist.amount).toBe(27.0);
    expect(truist.date).toBe('2026-10-05');
    expect(truist.pending).toBe(true);
    expect(truist.status).toBe('pending');
    expect(truist.accountId).toBe('acc_adv_relationship_banking');
    expect(truist.accountName).toBe('BOA Checking #4488 (Personal Checking)');
    expect(truist.institution).toBe('Bank of America');

    // 2. Starbucks
    const starbucks = summary.parsedTransactions[1];
    expect(starbucks.id).toBe('XAyOKzdJvYHMDo63KQANuQVKmDzBkaizXwXnP');
    expect(starbucks.amount).toBe(13.0);
    expect(starbucks.cleanMerchant).toBe('Starbucks');
    expect(starbucks.pending).toBe(true);
    expect(starbucks.status).toBe('pending');
    expect(starbucks.accountId).toBe('acc_adv_relationship_banking');

    // 3. Zelle to Kimberley Ines
    const zelle = summary.parsedTransactions[2];
    expect(zelle.id).toBe('DMRpmqQdj4IoxzN4Qj7acjaQyq6XKYFVR14Ze');
    expect(zelle.amount).toBe(520.0);
    expect(zelle.pending).toBe(true);
    expect(zelle.status).toBe('pending');
    expect(zelle.accountId).toBe('acc_wsfs_direct_checking');
    expect(zelle.accountName).toBe('WSFS Checking #6195');
    expect(zelle.institution).toBe('WSFS');

    // 4. Affirm Payment
    const affirm = summary.parsedTransactions[3];
    expect(affirm.id).toBe('6a0kApY5MqFYxyvNmLa8Snxw45zERrtAjoj8q');
    expect(affirm.amount).toBe(44.24);
    expect(affirm.pending).toBe(true);
    expect(affirm.status).toBe('pending');
    expect(affirm.accountId).toBe('acc_adv_relationship_banking');

    // Mathematical variance reconciliation
    const totalOutflow = 27.0 + 13.0 + 520.0 + 44.24; // 604.24
    expect(summary.variance?.stagedDebits).toBeCloseTo(totalOutflow);
    expect(summary.variance?.rawDebits).toBeCloseTo(totalOutflow);
    expect(summary.variance?.deltaDebits).toBe(0);
    expect(summary.variance?.explanation).toContain('100% match');
  });
});
