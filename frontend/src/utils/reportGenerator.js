/**
 * Generate a styled HTML report and trigger print/save as PDF.
 * Mirrors the UI color-coded line-by-line verification exactly.
 */
export function generatePDFReport(auditData, inputText) {
  const { summary, claims, citations, session_id, created_at } = auditData;

  const getStatusColor = (status) => {
    if (status === 'verified') return '#22c55e';
    if (status === 'unverified' || status === 'inconclusive') return '#f59e0b';
    if (status === 'hallucinated') return '#ef4444';
    return '#94a3b8';
  };

  const getStatusLabel = (status) => {
    if (status === 'verified') return '✓ Verified';
    if (status === 'unverified' || status === 'inconclusive') return '? Partial';
    if (status === 'hallucinated') return '✗ Error';
    return '— Unchecked';
  };

  const getTrustColor = (score) => {
    if (score >= 70) return '#7c3aed';
    if (score >= 40) return '#F39C12';
    return '#C0392B';
  };

  // Build line-by-line annotated text (mirrors AnnotatedText component)
  const sentences = inputText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);

  const annotatedLinesHTML = sentences.map((sentence, idx) => {
    const matchedClaim = claims.find(claim => {
      const claimText = claim.text || '';
      return sentence.includes(claimText) || claimText.includes(sentence.trim()) ||
        (claimText.length > 20 && sentence.length > 20 &&
          claimText.substring(0, 30).toLowerCase() === sentence.substring(0, 30).toLowerCase());
    });

    const status = matchedClaim ? (matchedClaim.status || 'unverified') : 'unchecked';
    const confidence = matchedClaim ? (matchedClaim.confidence || 0) : 0;
    const color = getStatusColor(status);
    const label = getStatusLabel(status);
    const underlineStyle = status === 'unchecked' ? 'dotted' : 'solid';

    return `
      <div style="display: flex; gap: 12px; align-items: flex-start; padding: 8px 12px; border-left: 3px solid ${color}; margin-bottom: 4px; border-radius: 4px;">
        <span style="font-size: 10px; font-family: monospace; color: #94a3b8; min-width: 24px; text-align: right; margin-top: 3px;">${idx + 1}</span>
        <div style="flex: 1;">
          <p style="font-size: 13px; line-height: 1.7; color: #1e293b; margin: 0; text-decoration: underline; text-decoration-color: ${color}; text-decoration-style: ${underlineStyle}; text-underline-offset: 4px; text-decoration-thickness: 2px;">
            ${sentence.trim()}
          </p>
          ${matchedClaim ? `
            <div style="margin-top: 4px; display: flex; gap: 12px; align-items: center; font-size: 10px;">
              <span style="color: ${color}; font-weight: 600; padding: 1px 6px; border: 1px solid ${color}40; border-radius: 4px; background: ${color}10;">${label}</span>
              <span style="color: #64748b;">Confidence: <strong style="color: ${color};">${(confidence * 100).toFixed(0)}%</strong></span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Build claim-by-claim detailed cards
  const claimsHTML = claims.map((claim, i) => `
    <div style="border-left: 2px solid ${getStatusColor(claim.status)}; padding: 16px; margin-bottom: 16px; border-radius: 4px; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; background: #fafafa;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-size: 11px; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">CLAIM #${claim.id}</span>
        <span style="color: ${getStatusColor(claim.status)}; padding: 4px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; border: 1px solid ${getStatusColor(claim.status)}40; border-radius: 4px;">
          ${getStatusLabel(claim.status)} ${claim.status}
        </span>
      </div>
      <p style="font-size: 14px; color: #1e293b; margin: 0 0 12px 0; line-height: 1.6; font-weight: 400;">"${claim.text}"</p>
      <div style="display: flex; gap: 20px; font-size: 12px; color: #64748b;">
        <span>Confidence: <strong style="color: ${getStatusColor(claim.status)}; font-weight: 600;">${(claim.confidence * 100).toFixed(0)}%</strong></span>
        ${claim.source_title ? `<span>Source: <em style="color: #475569;">${claim.source_title}</em></span>` : '<span>No matching source found</span>'}
      </div>
      ${claim.agent_reasoning ? `<div style="margin-top: 8px; font-size: 11px; color: #475569; font-style: italic;">Agent: ${claim.agent_reasoning}</div>` : ''}
      ${claim.contradiction ? `
        <div style="margin-top: 10px; display: flex; gap: 8px;">
          <div style="flex: 1; background: #fee; padding: 8px; border-radius: 6px; border: 1px solid #fcc;">
            <div style="font-size: 10px; color: #c0392b; font-weight: 700; margin-bottom: 4px;">⚡ CLAIM SAYS</div>
            <div style="font-size: 11px; color: #333;">${claim.contradiction.claim_says}</div>
          </div>
          <div style="flex: 1; background: #efe; padding: 8px; border-radius: 6px; border: 1px solid #cfc;">
            <div style="font-size: 10px; color: #27ae60; font-weight: 700; margin-bottom: 4px;">✓ SOURCE SAYS</div>
            <div style="font-size: 11px; color: #333;">${claim.contradiction.source_says}</div>
          </div>
        </div>
      ` : ''}
    </div>
  `).join('');

  const citationsHTML = citations && citations.length > 0 ? `
    <div style="margin-top: 30px; page-break-before: auto;">
      <h2 style="font-size: 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
        👻 Ghost Citation Audit
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <th style="text-align: left; padding: 10px 8px; color: #475569; font-weight: 500;">Type</th>
            <th style="text-align: left; padding: 10px 8px; color: #475569; font-weight: 500;">Citation</th>
            <th style="text-align: center; padding: 10px 8px; color: #475569; font-weight: 500;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${citations.map(c => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-transform: uppercase; font-size: 10px; font-weight: 600; color: #888;">${c.type}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; word-break: break-all;">${c.value}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
                <span style="background: ${c.status === 'verified' ? '#27AE6020' : c.status === 'ghost' ? '#C0392B20' : '#F39C1220'}; color: ${c.status === 'verified' ? '#27AE60' : c.status === 'ghost' ? '#C0392B' : '#F39C12'}; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700;">
                  ${c.status === 'ghost' ? '👻 GHOST' : c.status === 'verified' ? '✓ VALID' : '? UNCERTAIN'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const verifiedCount = claims.filter(c => c.status === 'verified').length;
  const errorCount = claims.filter(c => c.status === 'hallucinated').length;
  const partialCount = claims.length - verifiedCount - errorCount;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>VerityLens Audit Report</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #1a1a2e; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 24px;">
        <div>
          <h1 style="font-size: 26px; margin: 0; color: #0f172a; font-weight: 600; letter-spacing: -0.5px;">
            VerityLens <span style="font-weight: 300; color: #64748b;">Audit Report</span>
          </h1>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 6px;">
            Generated: ${new Date(created_at || Date.now()).toLocaleString()} 
            ${session_id ? ` • Session: <span style="font-family: monospace;">${session_id.substring(0, 8)}</span>` : ''}
          </p>
        </div>
        <div style="text-align: center; padding: 12px 24px; border-radius: 6px; border: 1px solid ${getTrustColor(summary.trust_score)}40; background: #fafafa;">
          <div style="font-size: 32px; font-weight: 600; color: ${getTrustColor(summary.trust_score)}; letter-spacing: -1px;">${summary.trust_score}%</div>
          <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-top: 4px;">Trust Score</div>
        </div>
      </div>

      <!-- Summary -->
      <div style="display: flex; gap: 16px; margin-bottom: 32px;">
        <div style="flex: 1; border: 1px solid #e2e8f0; padding: 20px; border-radius: 6px; text-align: center; background: #fafafa;">
          <div style="font-size: 28px; font-weight: 500; color: #0f172a; margin-bottom: 4px;">${summary.total_claims}</div>
          <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Total Claims</div>
        </div>
        <div style="flex: 1; border: 1px solid #bbf7d0; padding: 20px; border-radius: 6px; text-align: center; background: #f0fdf4;">
          <div style="font-size: 28px; font-weight: 500; color: #16a34a; margin-bottom: 4px;">${summary.verified_count}</div>
          <div style="font-size: 10px; color: #16a34a; text-transform: uppercase; letter-spacing: 1px;">Verified</div>
        </div>
        <div style="flex: 1; border: 1px solid #fef08a; padding: 20px; border-radius: 6px; text-align: center; background: #fefce8;">
          <div style="font-size: 28px; font-weight: 500; color: #ca8a04; margin-bottom: 4px;">${summary.unverified_count}</div>
          <div style="font-size: 10px; color: #ca8a04; text-transform: uppercase; letter-spacing: 1px;">Unverified</div>
        </div>
        <div style="flex: 1; border: 1px solid #fecaca; padding: 20px; border-radius: 6px; text-align: center; background: #fef2f2;">
          <div style="font-size: 28px; font-weight: 500; color: #dc2626; margin-bottom: 4px;">${summary.hallucinated_count}</div>
          <div style="font-size: 10px; color: #dc2626; text-transform: uppercase; letter-spacing: 1px;">Hallucinated</div>
        </div>
      </div>

      <!-- Color-Coded Line-by-Line Analysis -->
      <h2 style="font-size: 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
        Line-by-Line Verification (${sentences.length} lines)
      </h2>
      <div style="margin-bottom: 32px;">
        <!-- Legend -->
        <div style="display: flex; gap: 20px; margin-bottom: 12px; font-size: 10px; color: #64748b;">
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 16px; height: 2px; background: #22c55e; display: inline-block;"></span> Verified</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 16px; height: 2px; background: #f59e0b; display: inline-block;"></span> Partial</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 16px; height: 2px; background: #ef4444; display: inline-block;"></span> Error</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 16px; height: 2px; background: #94a3b8; display: inline-block; border-bottom: 1px dotted #94a3b8;"></span> Unchecked</span>
        </div>
        ${annotatedLinesHTML}
      </div>

      <!-- Detailed Claims -->
      <h2 style="font-size: 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
        Detailed Audit Trail (${claims.length} claims)
      </h2>
      ${claimsHTML}

      ${citationsHTML}

      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; font-size: 10px; color: #aaa;">
        VerityLens v2.0 — Hallucination Audit Trail for LLM-Generated Documents<br/>
        Created by Team ExWhyZed • Dedicated to building a more truthful AI ecosystem.
      </div>
    </body>
    </html>
  `;

  // Open in a new window and trigger print
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}
