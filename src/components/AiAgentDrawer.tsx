import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  X,
  Maximize2,
  Minimize2,
  Trash2,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Wallet,
  ShieldCheck,
  FileText,
  RotateCcw,
  Zap,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import {
  AgentMessage,
  AgentActionShortcut,
  FinancialContextSnapshot,
  generateCompleteUploadSummary,
  generateAttentionItems,
  answerFinancialQuery,
} from '../services/aiAgentEngine';
import { formatCurrency, formatPercent } from '../services/normalization';

interface AiAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string, filterOptions?: { classification?: string; query?: string }) => void;
  onOpenBriefing: () => void;
  onOpenWhatChanged: () => void;
  onOpenIngest: () => void;
  onOpenAudit?: (txId: string) => void;
  onOpenMetricAudit?: (metricKey: string) => void;
}

export const AiAgentDrawer: React.FC<AiAgentDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenBriefing,
  onOpenWhatChanged,
  onOpenIngest,
  onOpenAudit,
  onOpenMetricAudit,
}) => {
  const {
    businessName,
    dataMode,
    accounts,
    transactions,
    subscriptions,
    notes,
    briefing,
    dataHealth,
    latestReconciliationReport,
    thresholds,
    setFilters,
    handleBulkClassify,
  } = useFinancial();

  const [isExpanded, setIsExpanded] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build current context snapshot
  const snapshot: FinancialContextSnapshot = {
    businessName,
    dataMode,
    accounts,
    transactions,
    subscriptions,
    notes,
    briefing,
    dataHealth,
    latestReconciliationReport,
    thresholds,
  };

  // Initialize greeting message on first mount or when ledger resets
  useEffect(() => {
    if (messages.length === 0) {
      const initialGreeting: AgentMessage = {
        id: 'msg_welcome',
        sender: 'agent',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: `### 👋 Hello! I'm your Tasklet AI Financial Copilot\n\n` +
          `I have full context of all uploaded accounts, statements, and ledger tables for **${businessName}**.\n\n` +
          `You can ask me to **summarize everything that's uploaded**, tell you **what needs your attention**, or ask specific questions about cash flow, credit utilization, and anomalies.\n\n` +
          `I can also **open specific areas of the dashboard** directly to point out key figures.`,
        shortcuts: [
          {
            id: 'sc_init_sum',
            label: '📊 Summarize Everything Uploaded',
            description: 'Get an executive breakdown of all accounts & records',
            type: 'navigate_tab',
            targetTab: 'overview',
            variant: 'primary',
          },
          {
            id: 'sc_init_att',
            label: '⚠️ What Needs My Attention?',
            description: 'Inspect urgent warnings & high utilization cards',
            type: 'navigate_tab',
            targetTab: 'anomalies',
            variant: 'warning',
          },
          {
            id: 'sc_init_cash',
            label: '💧 How is My Cash Looking?',
            description: 'True available cash vs obligations',
            type: 'navigate_tab',
            targetTab: 'overview',
            variant: 'info',
          },
        ],
      };
      setMessages([initialGreeting]);
    }
  }, [businessName]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [messages, isOpen]);

  // Handle shortcut action execution
  const handleExecuteShortcut = (shortcut: AgentActionShortcut) => {
    switch (shortcut.type) {
      case 'navigate_tab':
        if (shortcut.targetTab) {
          onNavigateTab(shortcut.targetTab);
        }
        break;
      case 'filter_transactions':
        if (shortcut.targetTab) {
          onNavigateTab(shortcut.targetTab, shortcut.filter);
        }
        if (shortcut.filter) {
          setFilters((prev) => ({
            ...prev,
            classification: (shortcut.filter?.classification as any) || prev.classification,
            search: shortcut.filter?.query !== undefined ? shortcut.filter.query : prev.search,
            hasAnomalyOnly:
              shortcut.filter?.hasAnomalyOnly !== undefined
                ? shortcut.filter.hasAnomalyOnly
                : prev.hasAnomalyOnly,
          }));
        }
        break;
      case 'open_briefing':
        onOpenBriefing();
        break;
      case 'open_what_changed':
        onOpenWhatChanged();
        break;
      case 'open_ingest':
        onOpenIngest();
        break;
      case 'open_audit':
        if (shortcut.txId && onOpenAudit) {
          onOpenAudit(shortcut.txId);
        }
        break;
      case 'open_metric':
        if (shortcut.metricKey && onOpenMetricAudit) {
          onOpenMetricAudit(shortcut.metricKey);
        }
        break;
      case 'batch_classify_personal':
        handleBulkClassify(
          'personal',
          'Owner batch directive via Tasklet AI Copilot: marked remaining unreviewed transactions as personal'
        );
        const confirmMsg: AgentMessage = {
          id: `msg_batch_done_${Date.now()}`,
          sender: 'agent',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: `### ✅ Batch Classification Complete\n\nAll remaining unreviewed transactions have been successfully classified as **Personal Draw (Non-Business)** with full audit trail records.\n\nBusiness P&L is cleanly partitioned and 0 items remain in the unreviewed queue.`,
          shortcuts: [
            {
              id: 'sc_post_batch_txs',
              label: 'View Transactions Hub',
              type: 'navigate_tab',
              targetTab: 'transactions',
              variant: 'primary',
            },
            {
              id: 'sc_post_batch_overview',
              label: 'Command Overview',
              type: 'navigate_tab',
              targetTab: 'overview',
              variant: 'info',
            },
          ],
        };
        setMessages((prev) => [...prev, confirmMsg]);
        break;
    }
  };

  // Submit query
  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query) return;

    const userMsg: AgentMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    // Simulate natural thinking delay
    setTimeout(() => {
      const response = answerFinancialQuery(query, snapshot);
      setMessages((prev) => [...prev, response]);
      setIsTyping(false);
    }, 450);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div
        className={`relative z-10 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-full md:w-[750px]' : 'w-full md:w-[500px]'
        }`}
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-100">Tasklet AI Financial Agent</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded">
                  Live Copilot
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Context: {accounts.length} Accounts • {transactions.length} Txs • {dataHealth.overallConfidenceScore}% Health
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 text-slate-400">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition hidden md:block cursor-pointer"
              title={isExpanded ? 'Collapse Drawer' : 'Expand Drawer'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClearChat}
              className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Clear Conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Close Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips Bar */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
          <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Ask:</span>
          </span>
          <button
            onClick={() => handleSendMessage('Summarize everything that has been uploaded')}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 border border-slate-700 hover:border-indigo-500 transition shrink-0 cursor-pointer"
          >
            📊 Upload Summary
          </button>
          <button
            onClick={() => handleSendMessage('What needs my attention right now?')}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-300 border border-slate-700 hover:border-amber-500 transition shrink-0 cursor-pointer"
          >
            ⚠️ What Needs Attention?
          </button>
          <button
            onClick={() => handleSendMessage('How is my cash and liquidity looking?')}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 border border-slate-700 hover:border-emerald-500 transition shrink-0 cursor-pointer"
          >
            💧 Cash Waterfall
          </button>
          <button
            onClick={() => handleSendMessage('Check credit card utilization and limits')}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-300 border border-slate-700 hover:border-purple-500 transition shrink-0 cursor-pointer"
          >
            💳 Credit Utilization
          </button>
          <button
            onClick={() => handleSendMessage('Are there any duplicate charges or anomalies?')}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-300 border border-slate-700 hover:border-rose-500 transition shrink-0 cursor-pointer"
          >
            🚨 Anomalies
          </button>
        </div>

        {/* Conversation Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Message Header */}
              <div className="flex items-center space-x-1.5 mb-1 px-1 text-[11px] text-slate-500 font-mono">
                {msg.sender === 'agent' ? (
                  <>
                    <Bot className="w-3 h-3 text-indigo-400" />
                    <span>Tasklet AI</span>
                  </>
                ) : (
                  <span>You</span>
                )}
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              {/* Message Bubble */}
              <div
                className={`rounded-2xl p-4 text-xs max-w-[90%] leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-950/30'
                    : 'bg-slate-950 border border-slate-800/90 text-slate-200 rounded-tl-none shadow-sm'
                }`}
              >
                {/* Markdown text representation */}
                <div className="space-y-2 whitespace-pre-wrap font-sans">
                  {msg.content.split('\n\n').map((paragraph, pIdx) => {
                    if (paragraph.startsWith('### ')) {
                      return (
                        <h4 key={pIdx} className="text-sm font-bold text-slate-100 flex items-center gap-1.5 pt-1">
                          {paragraph.replace('### ', '')}
                        </h4>
                      );
                    }
                    if (paragraph.startsWith('#### ')) {
                      return (
                        <h5 key={pIdx} className="text-xs font-semibold text-indigo-300 pt-1">
                          {paragraph.replace('#### ', '')}
                        </h5>
                      );
                    }
                    if (paragraph.includes('\n- ')) {
                      const lines = paragraph.split('\n');
                      return (
                        <div key={pIdx} className="space-y-1">
                          {lines.map((line, lIdx) => (
                            <div key={lIdx} className="flex items-start space-x-1.5">
                              {line.startsWith('- ') ? (
                                <>
                                  <span className="text-indigo-400 mt-1">•</span>
                                  <span>{line.replace('- ', '')}</span>
                                </>
                              ) : (
                                <span>{line}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return <p key={pIdx}>{paragraph}</p>;
                  })}
                </div>

                {/* Summary Metric Cards (if any) */}
                {msg.summaryCards && msg.summaryCards.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80">
                    {msg.summaryCards.map((card, cIdx) => (
                      <div
                        key={cIdx}
                        className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-0.5"
                      >
                        <span className="text-[10px] text-slate-400 font-medium block truncate">
                          {card.title}
                        </span>
                        <div
                          className={`text-sm font-mono font-bold ${
                            card.status === 'positive'
                              ? 'text-emerald-400'
                              : card.status === 'warning'
                              ? 'text-amber-400'
                              : card.status === 'negative'
                              ? 'text-rose-400'
                              : 'text-slate-100'
                          }`}
                        >
                          {card.value}
                        </div>
                        {card.subtext && (
                          <span className="text-[9px] text-slate-500 block truncate">
                            {card.subtext}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Interactive Action Shortcuts ("Open certain areas of the app") */}
                {msg.shortcuts && msg.shortcuts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Take Action in App:</span>
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {msg.shortcuts.map((sc) => (
                        <button
                          key={sc.id}
                          onClick={() => handleExecuteShortcut(sc)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer group shadow-sm border ${
                            sc.variant === 'danger'
                              ? 'bg-rose-950/40 hover:bg-rose-900/50 text-rose-200 border-rose-500/30'
                              : sc.variant === 'warning'
                              ? 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-200 border-amber-500/30'
                              : sc.variant === 'info'
                              ? 'bg-sky-950/40 hover:bg-sky-900/50 text-sky-200 border-sky-500/30'
                              : sc.variant === 'success'
                              ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200 border-emerald-500/30'
                              : 'bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-200 border-indigo-500/30'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <span className="truncate">{sc.label}</span>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0 text-slate-400 group-hover:text-white">
                            <span className="text-[10px] font-normal hidden sm:inline">Open</span>
                            <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center space-x-2 text-slate-400 text-xs px-2 py-1">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
              <span className="text-[11px] text-slate-500 ml-1">Analyzing financial context...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask Tasklet AI about cash, credit, uploads, or what to look at..."
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={!inputQuery.trim() || isTyping}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition cursor-pointer shrink-0 shadow-md shadow-indigo-950/40"
              title="Send question to AI Agent"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 px-1">
            <span>Powered by In-Memory Financial Engine</span>
            <span>Shortcut: Press <strong>Ctrl+J</strong> to toggle</span>
          </div>
        </div>
      </div>
    </div>
  );
};
