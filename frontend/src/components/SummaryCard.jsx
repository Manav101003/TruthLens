import React, { useEffect, useState } from 'react';

function getScoreColor(score) {
  if (score >= 70) return { stroke: '#27AE60', text: 'text-green-400', bg: 'from-green-500/10 to-green-600/5', label: 'Reliable' };
  if (score >= 40) return { stroke: '#F39C12', text: 'text-amber-400', bg: 'from-amber-500/10 to-amber-600/5', label: 'Uncertain' };
  return { stroke: '#C0392B', text: 'text-red-400', bg: 'from-red-500/10 to-red-600/5', label: 'Unreliable' };
}

export default function SummaryCard({ summary }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const { total_claims, total_sentences, verified_count, unverified_count, hallucinated_count, non_verifiable_count, trust_score } = summary;
  const scoreInfo = getScoreColor(trust_score);

  // Animate score on mount
  useEffect(() => {
    let start = 0;
    const end = trust_score;
    const duration = 1500;
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * end * 10) / 10);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [trust_score]);

  // SVG circle calculations
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="verity-panel bg-gradient-to-br from-[#1e1e24] to-[#17171c] border border-white/10 rounded-2xl p-7 shadow-[0_8px_30px_rgba(0,0,0,0.5)] animate-fadeInUp h-full flex flex-col" style={{ animationDelay: '0.1s' }}>
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white">Audit Summary</h2>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-12">
        {/* Trust Score Ring */}
        <div className="trust-score-ring flex-shrink-0">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle className="ring-bg" cx="70" cy="70" r={radius} />
            <circle
              className="ring-fill"
              cx="70" cy="70" r={radius}
              stroke={scoreInfo.stroke}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="trust-score-value">
            <span className={`text-4xl font-bold tracking-tight ${scoreInfo.text}`}>
              {animatedScore}
            </span>
            <span className={`text-sm ${scoreInfo.text} opacity-70`}>%</span>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest">{scoreInfo.label}</p>
            {total_sentences > 0 && (
              <p className="text-[9px] text-slate-600 mt-1">
                Based on {total_claims} factual claim{total_claims !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        {/* Stats Grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
          {/* Total Sentences / Claims */}
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-6 shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all duration-500"></div>
            <p className="text-[13px] text-slate-400 font-semibold uppercase tracking-widest flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              {total_sentences ? 'Factual Claims' : 'Total Claims'}
            </p>
            <p className="text-4xl font-light text-white mt-3">{total_claims}</p>
            {total_sentences > 0 && (
              <p className="text-[11px] text-slate-500 mt-2">of {total_sentences} total sentences</p>
            )}
          </div>

          {/* Verified */}
          <div className="bg-gradient-to-br from-[#122a1f]/80 to-[#0d1a14]/80 border border-green-500/30 rounded-2xl p-6 shadow-lg hover:shadow-[0_0_20px_rgba(34,197,94,0.15)] transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all duration-500"></div>
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-green-400/80 font-semibold uppercase tracking-widest flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Verified
              </p>
            </div>
            <p className="text-4xl font-light text-green-400 mt-3">{verified_count}</p>
            <div className="mt-4 h-1.5 bg-green-950 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                style={{ width: `${total_claims > 0 ? (verified_count / total_claims) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Unverified */}
          <div className="bg-gradient-to-br from-[#2a2212]/80 to-[#1a150d]/80 border border-amber-500/30 rounded-2xl p-6 shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all duration-500"></div>
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-amber-400/80 font-semibold uppercase tracking-widest flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Unverified
              </p>
            </div>
            <p className="text-4xl font-light text-amber-400 mt-3">{unverified_count}</p>
            <div className="mt-4 h-1.5 bg-amber-950 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                style={{ width: `${total_claims > 0 ? (unverified_count / total_claims) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Hallucinated */}
          <div className="bg-gradient-to-br from-[#2a1212]/80 to-[#1a0d0d]/80 border border-red-500/30 rounded-2xl p-6 shadow-lg hover:shadow-[0_0_20px_rgba(239,68,68,0.15)] transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all duration-500"></div>
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-red-400/80 font-semibold uppercase tracking-widest flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                Hallucinated
              </p>
            </div>
            <p className="text-4xl font-light text-red-400 mt-3">{hallucinated_count}</p>
            <div className="mt-4 h-1.5 bg-red-950 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-red-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                style={{ width: `${total_claims > 0 ? (hallucinated_count / total_claims) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Non-Verifiable */}
          {(non_verifiable_count > 0) && (
            <div className="bg-gradient-to-br from-[#1a1a22]/80 to-[#151518]/80 border border-slate-600/20 rounded-2xl p-6 shadow-lg hover:shadow-[0_0_20px_rgba(100,116,139,0.1)] transition-all duration-300 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-slate-500/5 rounded-full blur-2xl group-hover:bg-slate-500/10 transition-all duration-500"></div>
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-slate-500/80 font-semibold uppercase tracking-widest flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Non-Verifiable
                </p>
              </div>
              <p className="text-4xl font-light text-slate-500 mt-3">{non_verifiable_count}</p>
              <p className="text-[10px] text-slate-600 mt-2">Opinions, transitions, non-factual</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
