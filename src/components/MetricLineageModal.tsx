import React from 'react';
import {
  X,
  Calculator,
  HelpCircle,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Percent,
  CheckCircle2,
} from 'lucide-react';
import { MetricLineage } from '../types';
import { formatCurrency } from '../services/normalization';

interface MetricLineageModalProps {
  lineage: MetricLineage | null;
  onClose: () => void;
}

export const MetricLineageModal: React.FC<MetricLineageModalProps> = ({
  lineage,
  onClose,
}) => {
  if (!lineage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Why Does This Number Say {lineage.formattedValue}?
              </h2>
              <span className="text-xs text-slate-400">
                Mathematical Lineage & Source Evidence Audit for {lineage.metricName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Formula & Value Banner */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Derivation Equation
              </span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                = {lineage.formattedValue}
              </span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-200 overflow-x-auto">
              {lineage.formula}
            </div>
            <p className="text-xs text-slate-300 pt-1">{lineage.explanation}</p>
          </div>

          {/* Component Derivations */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Step-by-Step Contributing Evidence ({lineage.components.length} components)</span>
            </h3>

            {lineage.components.map((comp, idx) => {
              const isSubtract = comp.operation === 'subtract';
              const isDivide = comp.operation === 'divide';

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          isSubtract
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            : isDivide
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {comp.operation}
                      </span>
                      <span className="font-semibold text-xs text-slate-100">{comp.name}</span>
                    </div>

                    <div className="font-mono font-bold text-sm text-slate-200">
                      {isSubtract ? '-' : ''}
                      {formatCurrency(comp.value)}
                    </div>
                  </div>

                  {/* Evidence Items Table */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {comp.evidence.length === 0 ? (
                      <div className="text-xs text-slate-500 py-1">No items found.</div>
                    ) : (
                      comp.evidence.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-800/60 flex items-center justify-between text-xs hover:border-slate-700 transition"
                        >
                          <div>
                            <div className="font-medium text-slate-200">{item.label}</div>
                            {item.detail && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {item.detail} • ID: {item.id}
                              </div>
                            )}
                          </div>

                          <div className="font-mono font-semibold text-slate-200">
                            {formatCurrency(item.amount)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Lineage verified against source feed records
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
