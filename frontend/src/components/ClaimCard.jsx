import React, { useState } from 'react';

const STATUS_CONFIG = {
  verified: {
    label: 'Verified',
    badgeClass: 'badge-verified',
    barColor: '#27AE60',
    icon: '✓',
    bgClass: 'border-green-500/20 hover:border-green-500/40'
  },
  unverified: {
    label: 'Unverified',
    badgeClass: 'badge-unverified',
    barColor: '#F39C12',
    icon: '?',
    bgClass: 'border-amber-500/20 hover:border-amber-500/40'
  },
  hallucinated: {
    label: 'Hallucinated',
    badgeClass: 'badge-hallucinated',
    barColor: '#C0392B',
    icon: '✗',
    bgClass: 'border-red-500/20 hover:border-red-500/40'
  },
  non_verifiable: {
    label: 'Non-Verifiable',
    badgeClass: 'badge-non-verifiable',
    barColor: '#64748b',
    icon: '—',
    bgClass: 'border-slate-500/10 hover:border-slate-500/20'
  }
};

export default function ClaimCard({ claim, index }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[claim.status] || STATUS_CONFIG.unverified;

  // Non-verifiable sentences get a compact dimmed card
  if (claim.status === 'non_verifiable') {
    return (
      <div
        className="verity-panel bg-[#17171c]/60 p-4 rounded-xl border border-slate-700/20 transition-all duration-300 animate-fadeInUp opacity-70 hover:opacity-90"
        style={{ animationDelay: `${0.1 + index * 0.04}s`, opacity: 0 }}
      >
        <div className="flex items-start gap-3">
          <span className="text-xs font-mono text-slate-600 bg-slate-800/30 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">
            #{claim.id}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-800/50 border border-slate-700/30 rounded px-1.5 py-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Non-Verifiable
              </span>
              <span className="text-[10px] text-slate-600 italic">{claim.non_verifiable_reason}</span>
            </div>
            <p className="text-[13px] text-slate-500 leading-relaxed">
              {claim.text}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`verity-panel bg-gradient-to-br from-[#1e1e24] to-[#17171c] p-6 rounded-2xl border transition-all duration-300 animate-fadeInUp ${config.bgClass}`}
      style={{ animationDelay: `${0.1 + index * 0.08}s`, opacity: 0 }}
    >
      {/* Top Row: Claim number + Badge + Confidence */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-mono text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded">
              #{claim.id}
            </span>
            <span className={`badge ${config.badgeClass}`}>
              {config.icon} {config.label}
            </span>
            {claim.contradiction && (
              <span className="badge bg-red-500/10 text-red-400 border border-red-500/30 text-[10px]">
                ⚡ Contradiction Detected
              </span>
            )}
          </div>

          {/* Claim Text */}
          <p className="verity-text text-[15px] text-slate-300 leading-relaxed font-light tracking-wide mt-2">
            "{claim.text}"
          </p>

          {/* Agent Reasoning (from LLM Auditor) */}
          {claim.agent_reasoning && (
            <div className="mt-3 flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <p className="verity-text-secondary text-xs text-purple-300/80 leading-relaxed italic">
                {claim.agent_reasoning}
              </p>
            </div>
          )}

          {/* Source Evidence Line */}
          {claim.source_line && (
            <div className="mt-2 flex items-start gap-2 pl-5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p className="verity-text-secondary text-[11px] text-blue-300/70 leading-relaxed">
                <span className="font-medium text-blue-400/90">Evidence:</span> "{claim.source_line}"
              </p>
            </div>
          )}
        </div>

        {/* Confidence Score */}
        <div className="text-right flex-shrink-0">
          <span className="text-3xl font-bold text-white tracking-tight">
            {claim.confidence != null ? (claim.confidence * 100).toFixed(0) : 'N/A'}
          </span>
          {claim.confidence != null && <span className="text-xs text-slate-400">%</span>}
          <p className="text-[10px] text-slate-500 mt-0.5">{claim.confidence_label}</p>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="mt-3">
        <div className="confidence-bar-track">
          <div
            className="confidence-bar-fill"
            style={{
              width: `${(claim.confidence || 0) * 100}%`,
              backgroundColor: config.barColor
            }}
          />
        </div>
      </div>

      {/* Corrected Text (from Fixer node — shown for hallucinated claims) */}
      {claim.corrected_text && (
        <div className="corrected-text-box mt-4 animate-fadeIn">
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Auto-Corrected Version</span>
          </div>
          <p className="text-sm text-emerald-200 leading-relaxed">
            "{claim.corrected_text}"
          </p>
          {claim.correction_source && (
            <p className="text-[10px] text-emerald-500/70 mt-1.5 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Source: {claim.correction_source}
            </p>
          )}
        </div>
      )}

      {/* Contradiction Mapping — Claim vs Reality */}
      {claim.contradiction && (
        <div className="mt-4 animate-fadeIn">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Contradiction Map
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* What the claim says */}
            <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Claim Says</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {claim.contradiction.claim_says}
              </p>
            </div>

            {/* What the source says */}
            <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Wikipedia Says</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {claim.contradiction.source_says}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expand Toggle */}
      {(claim.source_title || claim.comparison) && (
        <button
          className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          {expanded ? 'Hide Evidence' : 'View Evidence'}
        </button>
      )}

      {/* Expanded Evidence Section */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 animate-fadeIn">
          {/* Source comparison panel */}
          {claim.comparison && (
            <div className="bg-slate-900/50 rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  <span className="text-xs font-semibold text-slate-300">
                    Wikipedia: {claim.source_title}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-slate-500">
                    Match: <span className="text-blue-400 font-semibold">{claim.comparison.match_ratio}</span>
                  </span>
                  <span className="text-slate-500">
                    Entity: <span className={claim.comparison.entity_found ? 'text-green-400' : 'text-red-400'}>
                      {claim.comparison.entity_found ? '✓ Found' : '✗ Missing'}
                    </span>
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {claim.comparison.source_text}
              </p>
            </div>
          )}

          {/* Source link */}
          {claim.source_url && (
            <a
              href={claim.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              View Full Source on Wikipedia →
            </a>
          )}

          {!claim.source_title && (
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              No matching Wikipedia source found
            </p>
          )}
        </div>
      )}
    </div>
  );
}
