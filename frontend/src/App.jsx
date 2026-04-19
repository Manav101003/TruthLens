import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import InputPanel from './components/InputPanel';
import SummaryCard from './components/SummaryCard';
import ClaimCard from './components/ClaimCard';
import AnnotatedText from './components/AnnotatedText';
import CitationAuditPanel from './components/CitationAuditPanel';
import AgentToggle from './components/AgentToggle';
import AgentPathSidebar from './components/AgentPathSidebar';
import BackgroundAnimation from './components/BackgroundAnimation';
import { analyzeText, agentAnalyze } from './api/auditApi';
import { generatePDFReport } from './utils/reportGenerator';

// App phases: IDLE → LOADING → RESULTS
const PHASE = { IDLE: 'IDLE', LOADING: 'LOADING', RESULTS: 'RESULTS' };

// Loading messages that cycle during analysis
const LOADING_MESSAGES = [
  'Extracting factual claims...',
  'Querying Wikipedia...',
  'Hunting ghost citations...',
  'Analyzing entity matches...',
  'Detecting contradictions...',
  'Calculating confidence scores...',
  'Building audit report...'
];

// Agent-specific loading messages
const AGENT_LOADING_MESSAGES = [
  '⛏️ Miner: Extracting atomic claims...',
  '📄 Checking internal reference document...',
  '🧭 Classifying topic domain...',
  '📚 Researcher: Querying Wikipedia...',
  '🔍 Researcher: Serper web search...',
  '📰 Researcher: Checking news sources...',
  '⚖️ Auditor: Adversarial fact-checking...',
  '⚖️ Auditor: Evaluating confidence levels...',
  '🔄 Loop: Re-researching low-confidence claims...',
  '🔧 Fixer: Rewriting problematic claims...',
  '✅ Building verified audit report...'
];

export default function App() {
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [auditData, setAuditData] = useState(null);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [agentMode, setAgentMode] = useState(false);
  const [showAgentPath, setShowAgentPath] = useState(false);

  const handleAnalyze = useCallback(async (text, options = {}) => {
    setPhase(PHASE.LOADING);
    setError('');
    setInputText(text);

    // Cycle through appropriate loading messages
    const messages = agentMode ? AGENT_LOADING_MESSAGES : LOADING_MESSAGES;
    let msgIndex = 0;
    setLoadingMsg(messages[0]);
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length;
      setLoadingMsg(messages[msgIndex]);
    }, agentMode ? 2500 : 1800);

    try {
      const data = agentMode
        ? await agentAnalyze(text, options)
        : await analyzeText(text, options);
      setAuditData(data);
      setPhase(PHASE.RESULTS);
      // Auto-open agent path sidebar when agent mode returns a thinking log
      if (data.thinking_log && data.thinking_log.length > 0) {
        setShowAgentPath(true);
      }
    } catch (err) {
      const rawError = err.response?.data?.error || err.response?.data?.detail || err.message || 'An unexpected error occurred.';
      const message = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);
      setError(message);
      setPhase(PHASE.IDLE);
    } finally {
      clearInterval(msgInterval);
    }
  }, [agentMode]);

  const handleClear = useCallback(() => {
    setPhase(PHASE.IDLE);
    setAuditData(null);
    setInputText('');
    setError('');
    setShowAgentPath(false);
  }, []);

  const handleDownloadJSON = useCallback(() => {
    if (!auditData) return;
    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `veritylens_audit_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [auditData]);

  const handleDownloadPDF = useCallback(() => {
    if (!auditData) return;
    generatePDFReport(auditData, inputText);
  }, [auditData, inputText]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#171717]">
      <BackgroundAnimation />


      <Header />

      <main className="flex-1 pb-12 w-full relative z-10">
        {/* Exact Patronus Hero Section - Always Visible at Top */}
        <div className="text-center pt-24 pb-16 px-4 relative">
          <h1 className="text-5xl sm:text-[80px] font-medium text-white mb-6 tracking-tight leading-[1.1] max-w-5xl mx-auto animate-typewriter" style={{ animationDelay: '100ms' }}>
            Instant Clarity. <br /> Zero Hallucinations.
          </h1>
          <p className="text-[#a1a1aa] max-w-2xl mx-auto text-[20px] leading-relaxed font-light px-4 text-center animate-fade-up opacity-0" style={{ animationDelay: '300ms' }}>
            VerityLens develops verification infrastructure to accelerate progress toward reliable, hallucination-free AI systems.
          </p>

          <div className="mt-12 animate-fade-up opacity-0" style={{ animationDelay: '500ms' }}>
            <button 
              className="bg-transparent border border-[#3f3f46] text-white hover:bg-white/10 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 px-10 py-4 rounded-xl text-[17px] font-semibold"
              onClick={() => {
                document.getElementById('input-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Start Audit
            </button>
          </div>

          <div className="mt-16 flex justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce">
              <polyline points="7 13 12 18 17 13"></polyline>
              <polyline points="7 6 12 11 17 6"></polyline>
            </svg>
          </div>
        </div>

        {/* VerityLens Tool Container */}
        <div id="input-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 text-left relative z-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start h-[calc(100vh-140px)] min-h-[600px]">
            
            {/* Left Column: Tools Always Visible */}
            <div className="flex flex-col w-full h-full overflow-y-auto no-scrollbar">
              {/* Error Banner */}
              {error && (
                <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 flex items-center gap-3 animate-fadeIn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-red-400 text-sm">{error}</span>
                </div>
              )}

              {/* Input Panel Container */}
              <div className="mb-10 bg-[#16161a]/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.1)] relative z-30 animate-fadeInUp">
                {/* Floating effect glow */}
                <div className="absolute -inset-0.5 bg-gradient-to-br from-purple-500/20 to-transparent rounded-[2rem] opacity-50 blur-sm -z-10"></div>
                
                {/* Agent Mode Toggle */}
                <AgentToggle
                  agentMode={agentMode}
                  onToggle={() => setAgentMode(!agentMode)}
                  disabled={phase === PHASE.LOADING}
                />

                <div className="mt-6">
                  <InputPanel
                    onAnalyze={handleAnalyze}
                    isLoading={phase === PHASE.LOADING}
                    onClear={handleClear}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Status & Results */}
            <div className="flex flex-col w-full h-full overflow-hidden">
              
              {/* IDLE State: Tagline & Placeholder */}
              {phase === PHASE.IDLE && (
                <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[600px] bg-gradient-to-br from-[#16161a]/80 to-[#121216]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group animate-fadeIn">
                  {/* Animated Data Grid Background */}
                  <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700" style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                  
                  {/* Scanning Laser Line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent top-0 animate-[scan_3s_ease-in-out_infinite]"></div>
                  
                  {/* Placeholder Content */}
                  <div className="relative z-10 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(139,92,246,0.15)] relative">
                      <div className="absolute inset-0 rounded-full border border-purple-400/30 animate-ping" style={{ animationDuration: '3s' }}></div>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-400">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <circle cx="12" cy="10" r="4" />
                        <line x1="14.8" y1="12.8" x2="18" y2="16" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-medium text-white mb-4 tracking-tight">VerityLens Engine</h3>
                    <p className="text-slate-400 text-[15px] max-w-sm leading-relaxed">
                      <span className="text-purple-400 font-semibold">Did you know?</span> Over 80% of enterprise LLM deployments suffer from subtle factual drift. VerityLens automatically grounds every claim against primary sources to ensure irrefutable integrity.
                    </p>
                    
                    {/* Decorative floating dots */}
                    <div className="absolute top-10 -left-10 w-3 h-3 bg-blue-500/40 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                    <div className="absolute -top-5 right-10 w-2 h-2 bg-purple-500/40 rounded-full animate-bounce" style={{ animationDelay: '500ms' }}></div>
                    <div className="absolute bottom-10 -right-5 w-4 h-4 bg-green-500/20 rounded-full animate-bounce" style={{ animationDelay: '800ms' }}></div>
                  </div>
                </div>
              )}

              {/* LOADING State */}
              {phase === PHASE.LOADING && (
                <div className="flex flex-col items-center justify-center h-full min-h-[600px] bg-gradient-to-br from-[#16161a]/80 to-[#121216]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] py-20 px-8 shadow-2xl relative animate-fadeIn">
                  <div className="relative w-32 h-32 mb-8">
                    {/* Outer glowing rings */}
                    <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 animate-ping" style={{ animationDuration: '3s' }}></div>
                    <div className="absolute inset-2 rounded-full border border-purple-500/40 animate-[spin_4s_linear_infinite]"></div>
                    <div className="absolute inset-4 rounded-full border border-purple-400/30 animate-[spin_3s_linear_infinite_reverse]"></div>
                    
                    {/* Center Core */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-full shadow-[0_0_30px_rgba(139,92,246,0.6)] backdrop-blur-md flex items-center justify-center border border-purple-500/50">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-300 animate-pulse">
                          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                          <line x1="12" y1="22" x2="12" y2="15.5" />
                          <polyline points="22 8.5 12 15.5 2 8.5" />
                          <polyline points="2 15.5 12 8.5 22 15.5" />
                          <line x1="12" y1="2" x2="12" y2="8.5" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="text-center bg-[#1a1a1e] border border-white/5 rounded-2xl p-6 shadow-xl max-w-md w-full relative overflow-hidden">
                    {/* Subtle loading bar at top of card */}
                    <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent w-full animate-[translateX_2s_ease-in-out_infinite]" style={{ transform: 'translateX(-100%)' }}></div>

                    <h3 className="text-white font-semibold text-xl tracking-tight mb-2 flex items-center justify-center gap-2">
                      Processing Data
                      <span className="flex gap-1">
                        <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </span>
                    </h3>
                    
                    <p className="text-purple-300 font-medium text-[15px] animate-pulse">
                      {loadingMsg}
                    </p>
                    <p className="text-slate-500 text-[13px] mt-1.5">
                      {agentMode
                        ? 'Running self-correcting agent pipeline...'
                        : 'Evaluating factual consistency...'}
                    </p>

                    {/* Progress tracking dots */}
                    <div className="flex items-center justify-center gap-2.5 mt-6">
                      {(agentMode ? AGENT_LOADING_MESSAGES : LOADING_MESSAGES).map((msg, i) => {
                        const currentIndex = (agentMode ? AGENT_LOADING_MESSAGES : LOADING_MESSAGES).indexOf(loadingMsg);
                        const isPast = currentIndex > i;
                        const isCurrent = currentIndex === i;
                        
                        return (
                          <div
                            key={i}
                            className={`transition-all duration-500 rounded-full ${
                              isCurrent 
                                ? 'w-6 h-2 bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]' 
                                : isPast 
                                  ? 'w-2 h-2 bg-purple-400/50' 
                                  : 'w-2 h-2 bg-slate-800'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* RESULTS State */}
              {phase === PHASE.RESULTS && auditData && (
                <div className="h-full flex flex-col space-y-8 animate-fade-up overflow-y-auto pr-4 pb-12">
                  {/* Header / Actions Card */}
                  <div className="verity-panel bg-gradient-to-r from-[#1e1e24] to-[#17171c] border border-white/10 rounded-[2rem] p-6 shadow-2xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      {auditData.session_id && (
                        <div className="flex items-center gap-2 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          <span className="text-slate-500">Session:</span>
                          <span className="font-mono text-slate-300">{auditData.session_id.substring(0, 8)}...</span>
                        </div>
                      )}

                      {/* Agent Mode Badge */}
                      {auditData.agent_mode && (
                        <div className="flex items-center gap-2 text-xs bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 shadow-[0_0_10px_rgba(139,92,246,0.1)]">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                          </svg>
                          <span className="text-purple-400 font-medium">Agent Mode</span>
                          {auditData.iterations_used > 0 && (
                            <span className="text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              {auditData.iterations_used} loop{auditData.iterations_used > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}

                      {auditData.capped && (
                        <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                          ⚠ Document was truncated to 5,000 words. All claims within the limit were verified.
                        </div>
                      )}
                    </div>

                    {/* Export Buttons + Agent Path Toggle */}
                    <div className="flex items-center gap-2">
                      {/* Agent Path Button */}
                      {auditData.thinking_log && auditData.thinking_log.length > 0 && (
                        <button
                          id="agent-path-btn"
                          className="btn-secondary flex items-center gap-2 text-xs"
                          onClick={() => setShowAgentPath(!showAgentPath)}
                          style={{ borderColor: showAgentPath ? '#a855f7' : undefined, color: showAgentPath ? '#a855f7' : undefined }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                          </svg>
                          Agent Path
                        </button>
                      )}

                      <button
                        className="btn-secondary flex items-center gap-2 text-xs"
                        onClick={handleDownloadJSON}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        JSON
                      </button>
                      <button
                        className="btn-secondary flex items-center gap-2 text-xs"
                        onClick={handleDownloadPDF}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* Summary + Annotated Text: Stacked on right column */}
                  <div className="grid grid-cols-1 gap-8">
                    <SummaryCard summary={auditData.summary} />
                    <AnnotatedText text={inputText} claims={auditData.claims} />
                  </div>

                  {/* Ghost Citation Audit Panel */}
                  {auditData.citations && auditData.citations.length > 0 && (
                    <div className="mt-8">
                      <CitationAuditPanel
                        citations={auditData.citations}
                        summary={auditData.summary.citation_audit}
                      />
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Full-Width Detailed Audit Trail Below Grid */}
          {phase === PHASE.RESULTS && auditData && auditData.claims && (
            <div className="verity-panel mt-12 bg-gradient-to-br from-[#1e1e24] to-[#17171c] border border-white/10 rounded-[2rem] p-8 shadow-2xl animate-fadeInUp w-full max-w-7xl mx-auto">
              <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </div>
                <div>
                  <h2 className="verity-text text-xl font-bold text-white tracking-tight">
                    Detailed Audit Trail
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Complete verification analysis for {auditData.summary?.total_sentences || auditData.claims.length} sentences ({auditData.summary?.total_claims || auditData.claims.filter(c => c.is_factual !== false).length} factual claims verified)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {auditData.claims.map((claim, index) => (
                  <ClaimCard key={claim.id} claim={claim} index={index} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/5 text-center">
          <p className="text-xs text-slate-600">
            VerityLens v2.0 — Self-Correcting Agentic Verification Suite
          </p>
          <p className="text-xs text-slate-700 mt-1">
            Created by Team ExWhyZed • Dedicated to building a more truthful AI ecosystem.
          </p>
        </footer>
      </main>

      {/* Agent Path Sidebar */}
      <AgentPathSidebar
        thinkingLog={auditData?.thinking_log || []}
        isOpen={showAgentPath}
        onClose={() => setShowAgentPath(false)}
        iterationsUsed={auditData?.iterations_used || 0}
      />
    </div>
  );
}
