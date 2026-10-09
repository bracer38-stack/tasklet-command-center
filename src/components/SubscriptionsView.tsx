import React, { useState } from 'react';
import {
  Flame,
  Calendar,
  AlertCircle,
  TrendingUp,
  CreditCard,
  RefreshCw,
  Search,
  Edit3,
  Trash2,
  Plus,
  X,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { formatCurrency, formatDate } from '../services/normalization';
import { Subscription } from '../types';

export const SubscriptionsView: React.FC = () => {
  const {
    subscriptions,
    monthlyBurnRate,
    annualBurnRate,
    handleUpdateSubscription,
    handleDeleteSubscription,
    handleAddSubscription,
    accounts,
  } = useFinancial();

  const [searchTerm, setSearchTerm] = useState('');

  // Edit Subscription State
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [editForm, setEditForm] = useState({
    cleanMerchant: '',
    nextEstimatedDate: '',
    lastAmount: '',
    frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'annual',
    category: '',
    accountName: '',
  });

  // Add Custom Subscription State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSubForm, setNewSubForm] = useState({
    cleanMerchant: '',
    frequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'annual',
    lastAmount: '',
    nextEstimatedDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    category: 'Software & SaaS',
    accountId: '',
  });

  const openEditModal = (sub: Subscription) => {
    setEditingSub(sub);
    const dateStr = sub.nextEstimatedDate ? sub.nextEstimatedDate.slice(0, 10) : '';
    setEditForm({
      cleanMerchant: sub.cleanMerchant,
      nextEstimatedDate: dateStr,
      lastAmount: sub.lastAmount.toString(),
      frequency: sub.frequency,
      category: sub.category,
      accountName: sub.accountName,
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;
    const amt = parseFloat(editForm.lastAmount) || editingSub.lastAmount;
    handleUpdateSubscription(editingSub.id, {
      cleanMerchant: editForm.cleanMerchant.trim() || editingSub.cleanMerchant,
      nextEstimatedDate: editForm.nextEstimatedDate || editingSub.nextEstimatedDate,
      lastAmount: amt,
      averageAmount: amt,
      frequency: editForm.frequency,
      category: editForm.category.trim() || editingSub.category,
      accountName: editForm.accountName.trim() || editingSub.accountName,
    });
    setEditingSub(null);
  };

  const handleSaveNewSub = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newSubForm.lastAmount) || 0;
    const selectedAccount =
      accounts.find((a) => a.id === newSubForm.accountId) ||
      accounts[0] || { id: 'acc_primary', name: 'Primary Account' };

    const newSub: Subscription = {
      id: `sub_custom_${Date.now()}`,
      cleanMerchant: newSubForm.cleanMerchant.trim() || 'New Subscription',
      frequency: newSubForm.frequency,
      averageAmount: amt,
      lastAmount: amt,
      lastBilledDate: new Date().toISOString().slice(0, 10),
      nextEstimatedDate: newSubForm.nextEstimatedDate,
      category: newSubForm.category.trim() || 'Software & SaaS',
      accountName: selectedAccount.name,
      accountId: selectedAccount.id,
      status: 'active',
      transactionCount: 1,
      confidence: 'owner_confirmed',
      isEstimatedDate: false,
      userOverridden: true,
    };

    handleAddSubscription(newSub);
    setIsAddModalOpen(false);
    setNewSubForm({
      cleanMerchant: '',
      frequency: 'monthly',
      lastAmount: '',
      nextEstimatedDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      category: 'Software & SaaS',
      accountId: '',
    });
  };

  const filteredSubs = subscriptions.filter(
    (s) =>
      s.cleanMerchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.accountName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. Header & Burn Rate Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-400" />
              Subscriptions & Recurring Vendor Commitments
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated cadence detection for SaaS tools, leases, and recurring bills. Click "Edit" on any vendor to set its exact next renewal date.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Monthly SaaS Burn</span>
              <div className="text-lg font-bold text-rose-400 font-mono mt-0.5">
                {formatCurrency(monthlyBurnRate)}
                <span className="text-xs text-slate-400 font-normal">/mo</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Annualized Run-Rate</span>
              <div className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                {formatCurrency(annualBurnRate)}
                <span className="text-xs text-slate-400 font-normal">/yr</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Actions Toolbar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter subscriptions by vendor or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400 font-mono">
              {subscriptions.length} recurring vendors
            </span>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subscription</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Subscriptions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Vendor / Tool</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Cadence</th>
                <th className="py-3 px-4">Last Billed</th>
                <th className="py-3 px-4">Next Renewal</th>
                <th className="py-3 px-4">Billing Account</th>
                <th className="py-3 px-4 text-right">Amount / Trend</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    No subscriptions match your search.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub) => {
                  const hasPriceIncrease = sub.status === 'price_increased';

                  return (
                    <tr key={sub.id} className="hover:bg-slate-800/40 transition">
                      {/* Vendor & Confidence */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                          <span>{sub.cleanMerchant}</span>
                          {hasPriceIncrease && (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 rounded flex items-center gap-0.5">
                              <TrendingUp className="w-3 h-3 text-rose-400" />
                              +{sub.priceChangePercent}% Hike
                            </span>
                          )}
                          {sub.userOverridden || sub.confidence === 'owner_confirmed' ? (
                            <span className="text-[9px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 rounded">
                              Owner Confirmed
                            </span>
                          ) : sub.confidence === 'candidate_observed_once' ? (
                            <span className="text-[9px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 rounded">
                              Candidate (1 Charge)
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-1.5 rounded">
                              Recurrence (2+ Charges)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {sub.transactionCount} transactions analyzed
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {sub.category}
                        </span>
                      </td>

                      {/* Cadence */}
                      <td className="py-3.5 px-4 capitalize font-medium text-slate-300">
                        {sub.frequency}
                      </td>

                      {/* Last Billed */}
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {formatDate(sub.lastBilledDate)}
                      </td>

                      {/* Next Renewal */}
                      <td className="py-3.5 px-4 font-mono">
                        <button
                          onClick={() => openEditModal(sub)}
                          className="flex items-center gap-1 hover:text-emerald-300 transition cursor-pointer text-left flex-wrap"
                          title="Click to edit renewal date"
                        >
                          <Calendar className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className={sub.userOverridden ? 'text-emerald-400' : 'text-slate-200'}>
                            {formatDate(sub.nextEstimatedDate)}
                          </span>
                          {sub.userOverridden || sub.confidence === 'owner_confirmed' ? (
                            <span className="text-[9px] font-semibold text-emerald-300 bg-emerald-500/10 px-1 rounded ml-1">
                              Confirmed
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1 rounded ml-1">
                              Estimated
                            </span>
                          )}
                          <Edit3 className="w-2.5 h-2.5 text-slate-500 hover:text-slate-300 ml-0.5" />
                        </button>
                      </td>

                      {/* Account */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center space-x-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{sub.accountName}</span>
                        </div>
                      </td>

                      {/* Amount & Trend */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-100 font-mono text-sm">
                          {formatCurrency(sub.lastAmount)}
                        </div>
                        {sub.previousAmount && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Prev: {formatCurrency(sub.previousAmount)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openEditModal(sub)}
                            className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Edit subscription details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete recurring subscription "${sub.cleanMerchant}"?`
                                )
                              ) {
                                handleDeleteSubscription(sub.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                            title="Delete subscription"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Edit Subscription Modal */}
      {editingSub && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Edit Subscription</h3>
                  <p className="text-[11px] text-slate-400">{editingSub.cleanMerchant}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingSub(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Vendor / Tool Name</label>
                <input
                  type="text"
                  value={editForm.cleanMerchant}
                  onChange={(e) => setEditForm((f) => ({ ...f, cleanMerchant: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Next Renewal Date
                </label>
                <input
                  type="date"
                  value={editForm.nextEstimatedDate}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, nextEstimatedDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Select your vendor's actual next billing date.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cadence / Frequency</label>
                  <select
                    value={editForm.frequency}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        frequency: e.target.value as any,
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.lastAmount}
                    onChange={(e) => setEditForm((f) => ({ ...f, lastAmount: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Billing Account</label>
                  <input
                    type="text"
                    value={editForm.accountName}
                    onChange={(e) => setEditForm((f) => ({ ...f, accountName: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete recurring subscription "${editingSub.cleanMerchant}"?`
                      )
                    ) {
                      handleDeleteSubscription(editingSub.id);
                      setEditingSub(null);
                    }
                  }}
                  className="px-3 py-2 bg-rose-950/50 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-lg font-medium cursor-pointer flex items-center gap-1.5 text-xs transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingSub(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Custom Subscription Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Add Subscription</h3>
                  <p className="text-[11px] text-slate-400">Track a new recurring bill or SaaS tool</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewSub} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Vendor / Tool Name</label>
                <input
                  type="text"
                  placeholder="e.g. QuickBooks, AWS, Adobe Creative Cloud"
                  value={newSubForm.cleanMerchant}
                  onChange={(e) =>
                    setNewSubForm((f) => ({ ...f, cleanMerchant: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cadence / Frequency</label>
                  <select
                    value={newSubForm.frequency}
                    onChange={(e) =>
                      setNewSubForm((f) => ({
                        ...f,
                        frequency: e.target.value as any,
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newSubForm.lastAmount}
                    onChange={(e) =>
                      setNewSubForm((f) => ({ ...f, lastAmount: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Next Renewal Date</label>
                <input
                  type="date"
                  value={newSubForm.nextEstimatedDate}
                  onChange={(e) =>
                    setNewSubForm((f) => ({ ...f, nextEstimatedDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Software & SaaS, Hosting"
                    value={newSubForm.category}
                    onChange={(e) =>
                      setNewSubForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Billing Account</label>
                  <select
                    value={newSubForm.accountId}
                    onChange={(e) =>
                      setNewSubForm((f) => ({ ...f, accountId: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select an account</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.institution})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                  <span>Create Subscription</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
