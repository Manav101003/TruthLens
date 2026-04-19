import React, { useState, useMemo } from 'react';

/**
 * AnnotatedText — Line-by-line color-coded verification display.
 * Green underline = Verified, Yellow = Partial/Unverified, Red = Hallucinated.
 * Each line of the original text is matched against claims and color-coded.
 */
export default function AnnotatedText({ text, claims }) {
  const [hoveredLine, setHoveredLine] = useState(null);

  // Build line-by-line annotated view
  const annotatedLines = useMemo(() => {
    if (!text || !claims) return [];

    // Split text into sentences (lines)
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);

    return sentences.map((sentence, idx) => {
      // Find matching claim for this sentence
      const matchedClaim = claims.find(claim => {
        const claimText = claim.text || '';
        // Match by substring containment or significant overlap
        return sentence.includes(claimText) || claimText.includes(sentence.trim()) ||
          (claimText.length > 20 && sentence.length > 20 &&
            claimText.substring(0, 30).toLowerCase() === sentence.substring(0, 30).toLowerCase());
      });

      let status = 'unchecked'; // default — no claim matched this line
      let confidence = null;
      let reasoning = '';

      if (matchedClaim) {
        status = matchedClaim.status || 'unverified';
        confidence = matchedClaim.confidence;
        reasoning = matchedClaim.agent_reasoning || matchedClaim.reasoning || matchedClaim.non_verifiable_reason || '';
      }

      return {
        text: sentence.trim(),
        status,
        confidence,
        reasoning,
        claim: matchedClaim || null,
        lineNumber: idx + 1,
      };
    });
  }, [text, claims]);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'verified':
        return { borderColor: '#22c55e', bgColor: 'rgba(34,197,94,0.08)', label: '✓ Verified', labelColor: '#22c55e' };
      case 'unverified':
      case 'inconclusive':
        return { borderColor: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)', label: '? Partial', labelColor: '#f59e0b' };
      case 'hallucinated':
        return { borderColor: '#ef4444', bgColor: 'rgba(239,68,68,0.08)', label: '✗ Error', labelColor: '#ef4444' };
      case 'non_verifiable':
        return { borderColor: '#475569', bgColor: 'rgba(71,85,105,0.05)', label: '— Non-Verifiable', labelColor: '#64748b' };
      default:
        return { borderColor: '#64748b', bgColor: 'transparent', label: '— Unchecked', labelColor: '#64748b' };
    }
  };

  const totalLines = annotatedLines.length;
  const verifiedCount = annotatedLines.filter(l => l.status === 'verified').length;
  const errorCount = annotatedLines.filter(l => l.status === 'hallucinated').length;
  const partialCount = annotatedLines.filter(l => l.status === 'unverified' || l.status === 'inconclusive').length;
  const nonVerifiableCount = annotatedLines.filter(l => l.status === 'non_verifiable').length;

  return (
    <div className="verity-panel bg-gradient-to-br from-[#1e1e24] to-[#17171c] border border-white/10 rounded-2xl p-7 shadow-[0_8px_30px_rgba(0,0,0,0.5)] animate-fadeInUp h-full flex flex-col" style={{ animationDelay: '0.2s' }}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <div>
            <h2 className="verity-text text-lg font-semibold text-white">Line-by-Line Analysis</h2>
            <p className="text-xs text-slate-400">{totalLines} lines scanned • {verifiedCount} verified • {partialCount} partial • {errorCount} errors{nonVerifiableCount > 0 ? ` • ${nonVerifiableCount} non-verifiable` : ''}</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-5 text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-green-500 rounded-full"></div>
          <span className="text-slate-400">Verified</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-amber-500 rounded-full"></div>
          <span className="text-slate-400">Partial Evidence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-red-500 rounded-full"></div>
          <span className="text-slate-400">Unverified/Error</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-slate-600 rounded-full" style={{ borderTop: '1px dashed #475569' }}></div>
          <span className="text-slate-400">Non-Verifiable</span>
        </div>
      </div>

      {/* Line-by-line annotated content */}
      <div className="flex-1 overflow-y-auto max-h-[500px] space-y-1.5 pr-2 scrollbar-thin">
        {annotatedLines.map((line, i) => {
          const style = getStatusStyle(line.status);
          const isHovered = hoveredLine === i;

          return (
            <div
              key={i}
              className="relative group transition-all duration-200"
              onMouseEnter={() => setHoveredLine(i)}
              onMouseLeave={() => setHoveredLine(null)}
            >
              <div
                className="flex gap-3 items-start px-4 py-2.5 rounded-lg transition-all duration-200 cursor-default"
                style={{
                  borderLeft: `3px solid ${style.borderColor}`,
                  background: isHovered ? style.bgColor : 'transparent',
                }}
              >
                {/* Line number */}
                <span className="text-[11px] font-mono text-slate-600 mt-0.5 select-none flex-shrink-0 w-6 text-right">
                  {line.lineNumber}
                </span>

                {/* Line text with colored underline */}
                <div className="flex-1 min-w-0">
                  <p
                    className="verity-text text-[14px] leading-relaxed text-slate-300"
                    style={{
                      textDecorationLine: 'underline',
                      textDecorationColor: style.borderColor,
                      textDecorationStyle: line.status === 'unchecked' ? 'dotted' : 'solid',
                      textUnderlineOffset: '4px',
                      textDecorationThickness: '2px',
                    }}
                  >
                    {line.text}
                  </p>

                  {/* Confidence + Status + Reasoning (visible on hover) */}
                  {isHovered && line.claim && (
                    <div className="mt-2 space-y-1.5 animate-fadeIn">
                      <div className="flex items-center gap-3 text-xs">
                        <span
                          className="font-semibold px-2 py-0.5 rounded-md border"
                          style={{
                            color: style.labelColor,
                            borderColor: `${style.labelColor}40`,
                            background: `${style.labelColor}15`,
                          }}
                        >
                          {style.label}
                        </span>
                        {line.confidence != null && (
                          <span className="text-slate-500">
                            Confidence: <strong style={{ color: style.labelColor }}>{(line.confidence * 100).toFixed(0)}%</strong>
                          </span>
                        )}
                      </div>
                      {line.reasoning && (
                        <p className="verity-text-secondary text-[11px] text-slate-400 leading-relaxed pl-1 italic">
                          💡 {line.reasoning}
                        </p>
                      )}
                      {line.claim.source_line && (
                        <p className="verity-text-secondary text-[11px] text-blue-400/70 leading-relaxed pl-1">
                          📄 Evidence: "{line.claim.source_line}"
                        </p>
                      )}
                    </div>
                  )}
                  {/* Non-verifiable reason on hover (no claim match needed) */}
                  {isHovered && !line.claim && line.status === 'non_verifiable' && (
                    <div className="mt-2 animate-fadeIn">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold px-2 py-0.5 rounded-md border text-slate-500 border-slate-600/40 bg-slate-700/15">
                          — Non-Verifiable
                        </span>
                        <span className="text-slate-600 italic">{line.reasoning || 'Non-factual statement'}</span>
                      </div>
                    </div>
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
