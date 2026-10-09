import { describe, it, expect } from 'vitest';
import { buildFinancialExportManifest } from '../services/financialExport';
import { INITIAL_ACCOUNTS, INITIAL_TRANSACTIONS } from '../data/mockData';
import { generateDailyBriefing } from '../services/briefingEngine';

describe('financialExport Lineage Engine (Requirement 10)', () => {
  it('builds a complete manifest tracing dashboard numbers directly to source records', () => {
    const briefing = generateDailyBriefing(INITIAL_ACCOUNTS, INITIAL_TRANSACTIONS, []);
    const manifest = buildFinancialExportManifest({
      businessName: 'Acme Test Holdings',
      dataMode: 'imported_csv',
      accounts: INITIAL_ACCOUNTS,
      transactions: INITIAL_TRANSACTIONS,
      subscriptions: [],
      notes: [
        {
          id: 'note_1',
          category: 'Assumption',
          noteText: 'Test assumption text',
          createdDate: '2026-10-01',
        },
      ],
      briefing,
      monthlyBurnRate: 4500,
    });

    expect(manifest.exportMetadata.totalAccounts).toBe(INITIAL_ACCOUNTS.length);
    expect(manifest.exportMetadata.dataMode).toBe('imported_csv');
    expect(manifest.metricsLineageManifest.totalSettledCash.isValid).toBe(true);
    expect(manifest.metricsLineageManifest.totalSettledCash.sourceRecordIds.length).toBeGreaterThan(0);
    expect(manifest.metricsLineageManifest.trueAvailableCash.sourceRecordIds.length).toBeGreaterThan(0);
    expect(manifest.metricsLineageManifest.revolvingCreditDebt.evidenceBreakdown.length).toBeGreaterThan(0);
    expect(manifest.sourceRecords.notes.length).toBe(1);
  });

  it('correctly handles empty ledger state without crashing and labels metrics as invalid', () => {
    const emptyBriefing = generateDailyBriefing([], [], []);
    const manifest = buildFinancialExportManifest({
      businessName: 'Clean State LLC',
      dataMode: 'unknown_freshness',
      accounts: [],
      transactions: [],
      subscriptions: [],
      notes: [],
      briefing: emptyBriefing,
      monthlyBurnRate: 0,
    });

    expect(manifest.exportMetadata.totalAccounts).toBe(0);
    expect(manifest.metricsLineageManifest.totalSettledCash.isValid).toBe(false);
    expect(manifest.metricsLineageManifest.totalSettledCash.displayFormatted).toBe('—');
    expect(manifest.metricsLineageManifest.trueAvailableCash.displayFormatted).toBe('—');
  });
});
