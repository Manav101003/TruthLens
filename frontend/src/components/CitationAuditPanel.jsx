import React from 'react';

const STATUS_CONFIG = {
  verified: { label: 'Verified', color: 'green', icon: '✓', description: 'This reference exists and is valid' },
  ghost: { label: 'Ghost Citation', color: 'red', icon: '👻', description: 'This reference does not exist — likely fabricated by the LLM' },
  uncertain: { label: 'Uncertain', color: 'amber', icon: '?', description: 'Could not verify — source may be behind a paywall or temporarily unavailable' }
};

function CitationBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.uncertain;
  const colorClasses = {
    green: 'bg-green-500/10 text-green-400 border-green-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${colorClasses[config.color]}`}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

export default function CitationAuditPanel({ citations, summary }) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="glass-card p-6 animate-fadeInUp" style={{ animationDelay: '0.15s' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <span className="text-lg">👻</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">Ghost Citation Hunter</h2>
          <p className="text-xs text-slate-400">Verifying references cited in the text</p>
        </div>
      </div>

      {/* Summary Bar */}
      {summary && (
        <div className="flex items-center gap-4 mb-5 p-3 bg-slate-900/50 rounded-xl text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-300">{summary.total_citations}</span>
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">citations found</span>
          </div>
          <div className="w-px h-4 bg-slate-700"></div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-400 font-semibold">{summary.verified_citations}</span>
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">verified</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-400 font-semibold">{summary.ghost_citations}</span>
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">ghost</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            <span className="text-amber-400 font-semibold">{summary.uncertain_citations}</span>
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">uncertain</span>
          </div>
        </div>
      )}

      {/* Citation Cards */}
      <div className="space-y-3">
        {citations.map((citation, index) => {
          const config = STATUS_CONFIG[citation.status] || STATUS_CONFIG.uncertain;
          const borderColor = {
            green: 'border-green-500/20',
            red: 'border-red-500/20',
            amber: 'border-amber-500/20'
          }[config.color];

          return (
            <div
              key={index}
              className={`bg-slate-900/30 border ${borderColor} rounded-xl p-4 transition-all duration-300 hover:bg-slate-900/50`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Citation Type + Value */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                      {citation.type === 'doi' ? 'DOI' :
                       citation.type === 'url' ? 'URL' :
                       'CITATION'}
                    </span>
                    <CitationBadge status={citation.status} />
                  </div>

                  {/* Citation text */}
                  <p className="text-sm text-slate-300 font-mono break-all">
                    {citation.value}
                  </p>

                  {/* Verification details */}
                  {citation.verification?.title && citation.status === 'verified' && (
                    <p className="text-xs text-slate-400 mt-2">
                      📄 Found: <span className="text-slate-300">{citation.verification.title}</span>
                      {citation.verification.authors && (
                        <span className="text-slate-500"> — {citation.verification.authors}</span>
                      )}
                    </p>
                  )}

                  {citation.status === 'ghost' && (
                    <p className="text-xs text-red-400/80 mt-2 flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      Structural Hallucination — This reference appears to be fabricated
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
