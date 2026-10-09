import React, { useState } from 'react';
import { FinancialProvider, useFinancial } from './context/FinancialContext';
import { Header } from './components/Header';
import { KpiMetricsBar } from './components/KpiMetricsBar';
import { CommandOverview } from './components/CommandOverview';
import { TransactionsHub } from './components/TransactionsHub';
import { CardsAndLoansCenter } from './components/CardsAndLoansCenter';
import { SubscriptionsView } from './components/SubscriptionsView';
import { AnomaliesInbox } from './components/AnomaliesInbox';
import { FinancialDataHealthView } from './components/FinancialDataHealthView';
import { AuditTrailModal } from './components/AuditTrailModal';
import { DailyBriefingModal } from './components/DailyBriefingModal';
import { WhatChangedModal } from './components/WhatChangedModal';
import { DataIngestionModal } from './components/DataIngestionModal';
import { MetricLineageModal } from './components/MetricLineageModal';
import { ReconciliationReportModal } from './components/ReconciliationReportModal';
import { AiAgentDrawer } from './components/AiAgentDrawer';
import { Bot } from 'lucide-react';

const CommandCenterApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isBriefingOpen, setIsBriefingOpen] = useState<boolean>(false);
  const [isWhatChangedOpen, setIsWhatChangedOpen] = useState<boolean>(false);
  const [isIngestOpen, setIsIngestOpen] = useState<boolean>(false);
  const [isReconReportOpen, setIsReconReportOpen] = useState<boolean>(false);
  const [isAiAgentOpen, setIsAiAgentOpen] = useState<boolean>(false);

  // Global hotkey Ctrl+J or Cmd+K to toggle AI Agent
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J' || e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsAiAgentOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const {
    transactions,
    selectedTxForAudit,
    setSelectedTxForAudit,
    selectedMetricLineage,
    clearMetricLineage,
    latestReconciliationReport,
    handleInspectMetric,
  } = useFinancial();

  const handleOpenAudit = (txId: string) => {
    const target = transactions.find((t) => t.id === txId);
    if (target) {
      setSelectedTxForAudit(target);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBriefing={() => setIsBriefingOpen(true)}
        onOpenWhatChanged={() => setIsWhatChangedOpen(true)}
        onOpenIngest={() => setIsIngestOpen(true)}
        onOpenAiAgent={() => setIsAiAgentOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Persistent KPI Metric Strip with "Why?" lineage triggers */}
        <KpiMetricsBar />

        {/* Tab View Routing */}
        <div className="transition-all duration-150">
          {activeTab === 'overview' && (
            <CommandOverview
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenAudit={handleOpenAudit}
              onOpenIngest={() => setIsIngestOpen(true)}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsHub onOpenAudit={handleOpenAudit} />
          )}

          {activeTab === 'cards-loans' && <CardsAndLoansCenter />}

          {activeTab === 'subscriptions' && <SubscriptionsView />}

          {activeTab === 'anomalies' && (
            <AnomaliesInbox onOpenAudit={handleOpenAudit} />
          )}

          {activeTab === 'data-health' && (
            <FinancialDataHealthView
              onOpenMetricAudit={(metricKey) => handleInspectMetric(metricKey)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Tasklet Financial Command Center • Invariant Guard: Anti-Double-Counting, Idempotency & Zero-Guessing Active
          </span>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-400/90 font-mono">● Local In-Memory Engine</span>
            <span>No real credentials exposed</span>
          </div>
        </div>
      </footer>

      {/* Modals & Overlays */}
      {selectedTxForAudit && (
        <AuditTrailModal
          tx={selectedTxForAudit}
          onClose={() => setSelectedTxForAudit(null)}
        />
      )}

      {selectedMetricLineage && (
        <MetricLineageModal
          lineage={selectedMetricLineage}
          onClose={clearMetricLineage}
        />
      )}

      {isBriefingOpen && (
        <DailyBriefingModal
          onClose={() => setIsBriefingOpen(false)}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      )}

      {isWhatChangedOpen && (
        <WhatChangedModal
          onClose={() => setIsWhatChangedOpen(false)}
          onOpenAudit={handleOpenAudit}
        />
      )}

      {isReconReportOpen && latestReconciliationReport && (
        <ReconciliationReportModal
          report={latestReconciliationReport}
          onClose={() => setIsReconReportOpen(false)}
          onOpenAudit={handleOpenAudit}
        />
      )}

      {isIngestOpen && (
        <DataIngestionModal onClose={() => setIsIngestOpen(false)} />
      )}

      {/* Floating AI Agent Trigger Button */}
      <button
        onClick={() => setIsAiAgentOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white p-3.5 rounded-2xl shadow-2xl shadow-indigo-500/40 border border-purple-400/40 transition-all hover:scale-105 cursor-pointer flex items-center gap-2.5 group"
        title="Open Tasklet AI Financial Copilot (Ctrl+J)"
      >
        <div className="relative">
          <Bot className="w-5 h-5 text-white" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
        </div>
        <span className="text-xs font-bold pr-1 transition-all duration-200">
          AI Agent
        </span>
      </button>

      {/* Tasklet AI Agent Drawer */}
      <AiAgentDrawer
        isOpen={isAiAgentOpen}
        onClose={() => setIsAiAgentOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
        }}
        onOpenBriefing={() => setIsBriefingOpen(true)}
        onOpenWhatChanged={() => setIsWhatChangedOpen(true)}
        onOpenIngest={() => setIsIngestOpen(true)}
        onOpenAudit={handleOpenAudit}
        onOpenMetricAudit={(metricKey) => handleInspectMetric(metricKey)}
      />
    </div>
  );
};

export default function App() {
  return (
    <FinancialProvider>
      <CommandCenterApp />
    </FinancialProvider>
  );
}
