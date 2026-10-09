import React, { useState } from 'react';
import {
  CreditCard,
  Building,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Sliders,
  TrendingDown,
  RefreshCw,
  Wallet,
  Edit3,
  X,
  Save,
  DollarSign,
  Landmark,
  Trash2,
  Plus,
  Info,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatPercent, formatDate } from '../services/normalization';
import { calculateCardUtilization } from '../services/creditEngine';
import { Account, FinancialEntity } from '../types';

const DEMO_ACCOUNT_IDS = new Set([
  'acc_mercury_op',
  'acc_amex_plat',
  'acc_chase_tax',
  'acc_sba_loan',
  'acc_capone_spark',
  'acc_chase_pers',
  'acc_mercury_growth',
  'acc_brex_card',
  'acc_chase_biz_high',
  'acc_dep_main',
]);

export const CardsAndLoansCenter: React.FC = () => {
  const {
    accounts,
    thresholds,
    setThresholds,
    handleResolveStaleAccount,
    handleUpdateAccount,
    handleAddAccount,
    handleDeleteAccount,
    handlePurgeAllDemoAccounts,
  } = useFinancial();

  // State for Account Editor Modal
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    currentBalance: '',
    creditLimit: '',
    availableBalance: '',
    interestRate: '',
    monthlyPayment: '',
    isNoPresetLimit: false,
    entity: 'business' as FinancialEntity,
  });

  // State for Add Account Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    name: '',
    institution: '',
    mask: '',
    type: 'depository' as 'depository' | 'credit' | 'loan',
    subtype: 'checking' as any,
    currentBalance: '',
    creditLimit: '',
    availableBalance: '',
    interestRate: '',
    monthlyPayment: '',
    isNoPresetLimit: false,
    entity: 'business' as FinancialEntity,
  });

  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setEditForm({
      name: acc.name,
      currentBalance: acc.currentBalance.toString(),
      creditLimit: (acc.creditLimit || 0).toString(),
      availableBalance: (acc.availableBalance ?? acc.currentBalance ?? 0).toString(),
      interestRate: (acc.interestRate || 0).toString(),
      monthlyPayment: (acc.monthlyPayment || 0).toString(),
      isNoPresetLimit: !!acc.isNoPresetLimit,
      entity: acc.entity || (acc.isBusiness ? 'business' : 'personal'),
    });
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    const updates: Partial<Account> = {
      name: editForm.name.trim() || editingAccount.name,
      currentBalance: parseFloat(editForm.currentBalance) || 0,
      isNoPresetLimit: editForm.isNoPresetLimit,
      entity: editForm.entity,
      isBusiness: editForm.entity === 'business',
    };

    if (editingAccount.type === 'credit') {
      const limit = parseFloat(editForm.creditLimit);
      updates.creditLimit = !isNaN(limit) && limit >= 0 ? limit : 0;
      const apr = parseFloat(editForm.interestRate);
      if (!isNaN(apr)) updates.interestRate = apr;
    } else if (editingAccount.type === 'depository') {
      const avail = parseFloat(editForm.availableBalance);
      updates.availableBalance = !isNaN(avail) ? avail : updates.currentBalance;
    } else if (editingAccount.type === 'loan') {
      const pmt = parseFloat(editForm.monthlyPayment);
      if (!isNaN(pmt)) updates.monthlyPayment = pmt;
      const apr = parseFloat(editForm.interestRate);
      if (!isNaN(apr)) updates.interestRate = apr;
    }

    handleUpdateAccount(editingAccount.id, updates);
    setEditingAccount(null);
  };

  const handleSaveNewAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const curr = parseFloat(newAccountForm.currentBalance) || 0;
    const avail = parseFloat(newAccountForm.availableBalance);
    const limit = parseFloat(newAccountForm.creditLimit);
    const apr = parseFloat(newAccountForm.interestRate);
    const pmt = parseFloat(newAccountForm.monthlyPayment);

    const newAcc: Account = {
      id: `acc_user_${Date.now()}`,
      name: newAccountForm.name.trim() || 'New Account',
      officialName: newAccountForm.name.trim(),
      institution: newAccountForm.institution.trim() || 'Custom Institution',
      mask: newAccountForm.mask.trim() || '0000',
      type: newAccountForm.type,
      subtype: newAccountForm.subtype,
      currentBalance: curr,
      availableBalance: !isNaN(avail) ? avail : curr,
      creditLimit: newAccountForm.type === 'credit' && !isNaN(limit) ? limit : undefined,
      isNoPresetLimit: newAccountForm.isNoPresetLimit,
      entity: newAccountForm.entity,
      interestRate: !isNaN(apr) ? apr : undefined,
      monthlyPayment: newAccountForm.type === 'loan' && !isNaN(pmt) ? pmt : undefined,
      currency: 'USD',
      lastSyncedAt: new Date().toISOString(),
      isStale: false,
      isBusiness: newAccountForm.entity === 'business',
      status: 'active',
    };

    handleAddAccount(newAcc);
    setIsAddModalOpen(false);
    setNewAccountForm({
      name: '',
      institution: '',
      mask: '',
      type: 'depository',
      subtype: 'checking',
      currentBalance: '',
      creditLimit: '',
      availableBalance: '',
      interestRate: '',
      monthlyPayment: '',
      isNoPresetLimit: false,
      entity: 'business',
    });
  };

  const hasDemoAccounts = accounts.some((a) => DEMO_ACCOUNT_IDS.has(a.id));

  const depositoryAccounts = accounts.filter((a) => a.type === 'depository');
  const creditAccounts = accounts.filter((a) => a.type === 'credit');
  const loanAccounts = accounts.filter((a) => a.type === 'loan');

  // Overall Cash Metrics
  const totalSettledCash = depositoryAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalAvailableCash = depositoryAccounts.reduce((sum, a) => sum + (a.availableBalance ?? a.currentBalance ?? 0), 0);

  // Overall Revolving Metrics
  const totalCreditBalance = creditAccounts.reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);
  const totalCreditLimit = creditAccounts.reduce((sum, a) => sum + (a.creditLimit || 0), 0);
  const totalAvailableCredit = Math.max(0, totalCreditLimit - totalCreditBalance);
  const blendedUtilization = totalCreditLimit > 0 ? (totalCreditBalance / totalCreditLimit) * 100 : 0;

  // Total Loan Debt
  const totalLoanBalance = loanAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalMonthlyLoanPayments = loanAccounts.reduce((sum, a) => sum + (a.monthlyPayment || 0), 0);

  return (
    <div className="space-y-6">
      {/* Demo Accounts Warning Banner */}
      {hasDemoAccounts && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-amber-200">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg mt-0.5 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-100">
                Demo Template Accounts Detected (SBA Loan $118.5k, Mercury Checking $64.2k, etc.)
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Fixture accounts from the demo template are currently active alongside your imported accounts. Purge them to remove the phantom loan and reflect your true cash & debt numbers.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (
                window.confirm(
                  'Purge all demo template accounts? This will remove the demo SBA loan, Mercury accounts, and demo credit cards, leaving only your real imported accounts.'
                )
              ) {
                handlePurgeAllDemoAccounts();
              }
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4" />
            <span>Purge All Demo Accounts</span>
          </button>
        </div>
      )}

      {/* Helper Note for CSV Statement Calibration */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-slate-100">Bank Statement & Plaid CSV Calibration:</span>
            {' '}Standard bank and Plaid transaction CSV exports supply transaction deltas. Click <strong className="text-indigo-300 font-medium">Edit Balance</strong> on any account to fine-tune your actual starting balance or credit limit. All edits save automatically.
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>
        </div>
      </div>
      {/* 1. Operating Cash & Depository Accounts Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-400" />
              Operating Cash & Bank Checking Accounts
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live depository balances from bank feeds and CSV imports. Click "Edit Balance" to calibrate settled or available funds.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Settled Cash</span>
              <div className="text-sm font-bold text-slate-100 font-mono">
                {formatCurrency(totalSettledCash)}
              </div>
            </div>
            <div className="bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-right">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold">Total Available Cash</span>
              <div className="text-sm font-bold text-emerald-300 font-mono">
                {formatCurrency(totalAvailableCash)}
              </div>
            </div>
          </div>
        </div>

        {depositoryAccounts.length === 0 ? (
          <div className="p-6 bg-slate-950/60 rounded-xl border border-slate-800 text-center text-slate-400 text-xs">
            No bank depository or checking accounts configured. Upload a bank statement or add an account.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {depositoryAccounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">{acc.name}</h4>
                    <div className="text-xs text-slate-400 flex items-center space-x-1.5 mt-0.5">
                      <span>{acc.institution}</span>
                      <span>•</span>
                      <span className="font-mono">••{acc.mask}</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1 rounded">
                        {acc.subtype.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditModal(acc)}
                      className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title="Edit account balance"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete account "${acc.name}"? This will also remove its associated transactions.`
                          )
                        ) {
                          handleDeleteAccount(acc.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                      title="Delete account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase">Settled Balance</span>
                    <div className="font-mono font-bold text-slate-100 text-sm mt-0.5">
                      {formatCurrency(acc.currentBalance)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase">Available Cash</span>
                    <div className="font-mono font-bold text-emerald-300 text-sm mt-0.5">
                      {formatCurrency(acc.availableBalance ?? acc.currentBalance)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Last synced: {formatDate(acc.lastSyncedAt)}</span>
                  <button
                    onClick={() => openEditModal(acc)}
                    className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    Edit Balance
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Revolving Credit & Threshold Configurator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-400" />
              Revolving Credit & Card Utilization
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor credit limits, current balances, and blended utilization. Click "Edit Balance & Limit" on any card to update limits (e.g. from default estimates to your actual credit limit).
            </p>
          </div>

          {/* Interactive Threshold Configurator */}
          <div className="flex items-center space-x-4 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-1.5 text-xs">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 font-medium">Alert Limits:</span>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-[11px] text-amber-300 font-medium">Warning:</label>
              <input
                type="number"
                min="10"
                max="90"
                value={thresholds.warningThreshold}
                onChange={(e) =>
                  setThresholds((t) => ({
                    ...t,
                    warningThreshold: Number(e.target.value) || 30,
                  }))
                }
                className="w-12 px-1.5 py-0.5 text-xs bg-slate-900 border border-amber-500/40 rounded text-amber-200 text-center font-mono focus:outline-none"
              />
              <span className="text-slate-500 text-xs">%</span>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-[11px] text-rose-300 font-medium">Danger:</label>
              <input
                type="number"
                min="20"
                max="95"
                value={thresholds.dangerThreshold}
                onChange={(e) =>
                  setThresholds((t) => ({
                    ...t,
                    dangerThreshold: Number(e.target.value) || 50,
                  }))
                }
                className="w-12 px-1.5 py-0.5 text-xs bg-slate-900 border border-rose-500/40 rounded text-rose-200 text-center font-mono focus:outline-none"
              />
              <span className="text-slate-500 text-xs">%</span>
            </div>
          </div>
        </div>

        {/* Global Revolving Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Revolving Debt</span>
            <div className="text-lg font-bold text-slate-100 mt-0.5">
              {formatCurrency(totalCreditBalance)}
            </div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Credit Limit</span>
            <div className="text-lg font-bold text-slate-100 mt-0.5">
              {formatCurrency(totalCreditLimit)}
            </div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Available Credit Line</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {formatCurrency(totalAvailableCredit)}
            </div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Blended Utilization</span>
            <div
              className={`text-lg font-bold mt-0.5 ${
                blendedUtilization >= thresholds.dangerThreshold
                  ? 'text-rose-400'
                  : blendedUtilization >= thresholds.warningThreshold
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {formatPercent(blendedUtilization)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Individual Cards Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <span>Individual Credit Cards & Limits</span>
            <span className="text-xs text-slate-400 font-normal">({creditAccounts.length} cards)</span>
          </h3>
          <span className="text-xs text-slate-400">Click any card's edit button to calibrate actual balance or credit limit</span>
        </div>

        {creditAccounts.length === 0 ? (
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 text-center text-slate-400 text-xs">
            No credit cards currently registered.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creditAccounts.map((acc) => {
              const report = calculateCardUtilization(acc, thresholds);
              if (!report) return null;

              const isNpsl = report.isNoPresetLimit;
              const isWarning = report.status === 'warning';
              const isDanger = report.status === 'danger' || report.status === 'critical';
              const isPersonal = acc.entity === 'personal' || !acc.isBusiness;

              return (
                <div
                  key={acc.id}
                  className={`bg-slate-900 rounded-xl p-5 border shadow-sm transition space-y-4 ${
                    isDanger && !isNpsl
                      ? 'border-rose-500/40 shadow-rose-950/10'
                      : isWarning && !isNpsl
                      ? 'border-amber-500/40 shadow-amber-950/10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Card Title & Status Badge */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-slate-100">{acc.name}</h4>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded border font-medium ${
                            isPersonal
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                          }`}
                        >
                          {isPersonal ? 'Personal' : 'Business'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{acc.institution}</span>
                        <span>•</span>
                        <span className="font-mono">••{acc.mask}</span>
                        {acc.interestRate && (
                          <>
                            <span>•</span>
                            <span>APR {acc.interestRate}%</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isNpsl ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          Charge Card (NPSL)
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isDanger
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                              : isWarning
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {isDanger ? 'Above 50% High' : isWarning ? 'Above 30% Warning' : 'Healthy'}
                        </span>
                      )}
                      <button
                        onClick={() => openEditModal(acc)}
                        className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                        title="Edit credit limit and balance"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete card "${acc.name}"? This will also remove its associated transactions.`
                            )
                          ) {
                            handleDeleteAccount(acc.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                        title="Delete card"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Utilization Gauge */}
                  {isNpsl ? (
                    <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-300 font-semibold">
                        <span>No Preset Spending Limit</span>
                        <span className="text-cyan-400 font-mono text-[11px]">Paid In Full Monthly</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Statement balance is settled each billing cycle. Excluded from blended revolving utilization ratios.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Card Utilization:</span>
                        <span className="font-mono font-extrabold text-sm text-slate-100">
                          {formatPercent(report.utilizationRate)}
                        </span>
                      </div>

                      <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isDanger
                              ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                              : isWarning
                              ? 'bg-gradient-to-r from-emerald-500 to-amber-400'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, report.utilizationRate)}%` }}
                        />
                      </div>

                      {/* Marker ticks for 30% and 50% */}
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono px-0.5">
                        <span>0%</span>
                        <span className="text-amber-400/80">30% (Warning)</span>
                        <span className="text-rose-400/80">50% (Danger)</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}

                  {/* Balance vs Limit Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">Current Balance</span>
                      <div className="font-mono font-bold text-slate-200 mt-0.5">
                        {formatCurrency(report.currentBalance)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">Credit Limit</span>
                      <div className="font-mono font-semibold text-slate-300 mt-0.5">
                        {isNpsl ? 'No Preset Limit' : formatCurrency(report.creditLimit)}
                      </div>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-800/60 flex justify-between">
                      <span className="text-[11px] text-slate-400">Available Credit:</span>
                      <span className="font-mono font-medium text-emerald-400">
                        {isNpsl ? 'Dynamic (NPSL)' : formatCurrency(report.availableCredit)}
                      </span>
                    </div>
                  </div>

                  {/* Paydown Recommendation */}
                  {isNpsl ? (
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                        <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Monthly Charge Card Settlement</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Schedule statement payoff only after confirming core cash reserves (payroll, bills, tax floor).
                      </p>
                    </div>
                  ) : report.recommendedPaydownAmount > 0 ? (
                    <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                      <div className="flex items-center space-x-1.5 font-semibold text-amber-300">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>Optional Utilization Reduction</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Only after required cash reserves are confirmed: Pay <strong className="text-amber-300">{formatCurrency(report.recommendedPaydownAmount)}</strong> before statement closing to drop below {thresholds.warningThreshold}%.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-emerald-950/10 border border-emerald-500/20 text-[11px] text-emerald-400 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Utilization within healthy parameters (&lt; {thresholds.warningThreshold}%)</span>
                    </div>
                  )}

                  <div className="pt-1 text-right">
                    <button
                      onClick={() => openEditModal(acc)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Balance & Limit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Commercial Loans & Stale Feed Tracking */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Building className="w-4 h-4 text-cyan-400" />
              Commercial Term Loans & SBA Financing
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tracks amortization schedules, monthly obligations, and flags stale or disconnected bank feeds.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">Total Loan Obligations:</span>
            <div className="text-lg font-bold text-slate-100 font-mono">
              {formatCurrency(totalLoanBalance)}
            </div>
          </div>
        </div>

        {loanAccounts.length === 0 ? (
          <div className="p-6 bg-slate-950/60 rounded-xl border border-slate-800 text-center text-slate-400 text-xs">
            No loan or term debt accounts recorded.
          </div>
        ) : (
          <div className="space-y-3">
            {loanAccounts.map((loan) => (
              <div
                key={loan.id}
                className={`p-4 rounded-xl border transition ${
                  loan.isStale
                    ? 'bg-rose-950/20 border-rose-500/40 shadow-sm shadow-rose-950/20'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-slate-100">{loan.name}</h4>
                      <span className="text-xs text-slate-400 font-mono">••{loan.mask}</span>
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 rounded">
                        {loan.subtype.toUpperCase().replace('_', ' ')}
                      </span>
                      {loan.isStale && (
                        <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-rose-400" />
                          Stale Feed Alert
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Official Name: {loan.officialName} • Last synced: {formatDate(loan.lastSyncedAt)}
                    </p>
                    {loan.staleReason && (
                      <div className="text-xs text-rose-300 font-medium flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        <span>{loan.staleReason}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase">Remaining Principal</span>
                      <div className="font-mono font-bold text-rose-300 text-sm mt-0.5">
                        {formatCurrency(loan.currentBalance)}
                      </div>
                    </div>

                    <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase">Monthly Payment</span>
                      <div className="font-mono font-semibold text-slate-200 text-sm mt-0.5">
                        {formatCurrency(loan.monthlyPayment || 0)}/mo
                      </div>
                    </div>

                    <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase">Fixed APR</span>
                      <div className="font-mono font-semibold text-slate-200 text-sm mt-0.5">
                        {loan.interestRate}%
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditModal(loan)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                        title="Edit loan principal or monthly payment"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete loan "${loan.name}"? This will remove this loan from your obligations.`
                            )
                          ) {
                            handleDeleteAccount(loan.id);
                          }
                        }}
                        className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                        title="Delete loan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {loan.isStale && (
                        <button
                          onClick={() => handleResolveStaleAccount(loan.id)}
                          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Re-Authenticate Feed</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Account Edit Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Edit {editingAccount.type === 'credit' ? 'Credit Card' : editingAccount.type === 'loan' ? 'Loan' : 'Checking Account'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingAccount.institution} ••{editingAccount.mask}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingAccount(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Current Balance ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.currentBalance}
                  onChange={(e) => setEditForm((f) => ({ ...f, currentBalance: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {editingAccount.type === 'credit'
                    ? 'Total statement or current revolving balance owed.'
                    : editingAccount.type === 'loan'
                    ? 'Current unpaid principal balance.'
                    : 'Current ledger or book balance in checking/savings.'}
                </span>
              </div>

              {editingAccount.type === 'credit' && (
                <>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Credit Limit ($)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={editForm.creditLimit}
                      onChange={(e) => setEditForm((f) => ({ ...f, creditLimit: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Total spending limit authorized by your card issuer (e.g. 25000).
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      APR / Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.interestRate}
                      onChange={(e) => setEditForm((f) => ({ ...f, interestRate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              )}

              {editingAccount.type === 'depository' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Available Balance ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.availableBalance}
                    onChange={(e) => setEditForm((f) => ({ ...f, availableBalance: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Available cash after pending hold authorizations.
                  </span>
                </div>
              )}

              {editingAccount.type === 'loan' && (
                <>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Monthly Payment ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.monthlyPayment}
                      onChange={(e) => setEditForm((f) => ({ ...f, monthlyPayment: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.interestRate}
                      onChange={(e) => setEditForm((f) => ({ ...f, interestRate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete account "${editingAccount.name}"? This will remove this account and associated transactions.`
                      )
                    ) {
                      handleDeleteAccount(editingAccount.id);
                      setEditingAccount(null);
                    }
                  }}
                  className="px-3 py-2 bg-rose-950/50 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-lg font-medium cursor-pointer flex items-center gap-1.5 text-xs transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Account</span>
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingAccount(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Account</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add Custom Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Add Account</h3>
                  <p className="text-[11px] text-slate-400">
                    Add checking, savings, credit card, or term loan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Type</label>
                <select
                  value={newAccountForm.type}
                  onChange={(e) => {
                    const t = e.target.value as 'depository' | 'credit' | 'loan';
                    setNewAccountForm((f) => ({
                      ...f,
                      type: t,
                      subtype: t === 'depository' ? 'checking' : t === 'credit' ? 'credit_card' : 'term_loan',
                    }));
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="depository">Bank Depository (Checking / Savings)</option>
                  <option value="credit">Revolving Credit Card</option>
                  <option value="loan">Term Loan / Commercial Financing</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bank of America Checking 4488"
                  value={newAccountForm.name}
                  onChange={(e) => setNewAccountForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Financial Institution</label>
                  <input
                    type="text"
                    placeholder="e.g. Bank of America"
                    value={newAccountForm.institution}
                    onChange={(e) => setNewAccountForm((f) => ({ ...f, institution: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Last 4 Digits (Mask)</label>
                  <input
                    type="text"
                    placeholder="e.g. 4488"
                    maxLength={4}
                    value={newAccountForm.mask}
                    onChange={(e) => setNewAccountForm((f) => ({ ...f, mask: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {newAccountForm.type === 'credit'
                    ? 'Current Card Balance ($)'
                    : newAccountForm.type === 'loan'
                    ? 'Current Principal Balance ($)'
                    : 'Current Settled Balance ($)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newAccountForm.currentBalance}
                  onChange={(e) => setNewAccountForm((f) => ({ ...f, currentBalance: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {newAccountForm.type === 'depository' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Available Cash Balance ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Same as settled if no pending holds"
                    value={newAccountForm.availableBalance}
                    onChange={(e) => setNewAccountForm((f) => ({ ...f, availableBalance: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {newAccountForm.type === 'credit' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Credit Limit ($)</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="e.g. 25000"
                      value={newAccountForm.creditLimit}
                      onChange={(e) => setNewAccountForm((f) => ({ ...f, creditLimit: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">APR (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 19.99"
                      value={newAccountForm.interestRate}
                      onChange={(e) => setNewAccountForm((f) => ({ ...f, interestRate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {newAccountForm.type === 'loan' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Monthly Payment ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 1500"
                      value={newAccountForm.monthlyPayment}
                      onChange={(e) => setNewAccountForm((f) => ({ ...f, monthlyPayment: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">APR (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 7.5"
                      value={newAccountForm.interestRate}
                      onChange={(e) => setNewAccountForm((f) => ({ ...f, interestRate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
