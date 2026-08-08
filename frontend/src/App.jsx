import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import InputPanel from './components/InputPanel';
import SummaryCard from './components/SummaryCard';
import ClaimCard from './components/ClaimCard';
import AnnotatedText from './components/AnnotatedText';
import CitationAuditPanel from './components/CitationAuditPanel';
import AgentToggle from './components/AgentToggle';
import AgentPathSidebar from './components/AgentPathSidebar';
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

function ManuscriptDemo() {
  const [claim1, setClaim1] = useState(false);
  const [claim2, setClaim2] = useState(false);
  const [claim3, setClaim3] = useState(false);

  useEffect(() => {
    let timer1, timer2, timer3;

    function runCycle() {
      setClaim1(false);
      setClaim2(false);
      setClaim3(false);

      timer1 = setTimeout(() => setClaim1(true), 200);
      timer2 = setTimeout(() => setClaim2(true), 900);
      timer3 = setTimeout(() => setClaim3(true), 1600);
    }

    runCycle();
    const interval = setInterval(runCycle, 3600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="manuscript hero-anim d6">
      <div className="scanline"></div>
      <div className="manuscript-head">
        <span><span className="dot"></span>model output — gpt-4.1</span>
        <span>scan complete</span>
      </div>
      <div className="m-body" id="manuscript-body">
        <span className={`claim v ${claim1 ? 'on' : ''}`}>
          Mount Everest stands 8,849 meters above sea level
          <span className="tag">verified</span>
        </span>
        , making it the tallest mountain measured from sea level.{' '}
        <span className={`claim h ${claim2 ? 'on' : ''}`}>
          It was first summited in 1962 by a joint Nepali-French expedition
          <span className="tag">hallucinated</span>
        </span>
        {' '}— the first confirmed ascent was actually in 1953.{' '}
        <span className={`claim u ${claim3 ? 'on' : ''}`}>
          The mountain grows roughly 4mm taller every year
          <span className="tag">uncertain</span>
        </span>{' '}
        due to tectonic activity, a figure that varies across surveys.
      </div>
      <div className="m-footer">
        <span><i className="swatch" style={{ background: 'var(--verified)' }}></i>1 verified</span>
        <span><i className="swatch" style={{ background: 'var(--uncertain)' }}></i>1 uncertain</span>
        <span><i className="swatch" style={{ background: 'var(--halluc)' }}></i>1 hallucinated</span>
      </div>
    </div>
  );
}

function SigninSection({ user, onLogin, onLogout, userHistory = [], loadingHistory = false, handleLoadPastAudit }) {
  const [googleEmail, setGoogleEmail] = useState('');
  const [status, setStatus] = useState('');
  const [clientId, setClientId] = useState(() => {
    return localStorage.getItem('veritas_google_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  });
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    /* global google */
    if (typeof google !== 'undefined' && !user) {
      try {
        const container = document.getElementById("google-signin-element");
        if (container) {
          container.innerHTML = ''; // Clear previous button to prevent duplicates
        }

        if (!clientId) {
          return;
        }

        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            try {
              const base64Url = response.credential.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
              }).join(''));
              const payload = JSON.parse(jsonPayload);
              if (payload.email) {
                onLogin({ 
                  email: payload.email, 
                  name: payload.name || payload.email.split('@')[0], 
                  picture: payload.picture || null 
                });
              }
            } catch (err) {
              console.error("Failed to parse Google credential token:", err);
            }
          }
        });
        google.accounts.id.renderButton(
          container,
          { theme: "dark", size: "large", width: 280 }
        );
      } catch (err) {
        console.warn("Google button render error:", err);
      }
    }
  }, [user, onLogin, clientId]);

  const handleGoogleSubmit = (e) => {
    e.preventDefault();
    if (!googleEmail || !googleEmail.includes('@')) return;
    setStatus('Connecting to Google account...');
    setTimeout(() => {
      setStatus('');
      onLogin({
        email: googleEmail,
        name: googleEmail.split('@')[0],
        picture: null
      });
      setGoogleEmail('');
    }, 1000);
  };

  if (user) {
    return (
      <section id="signin" style={{ paddingTop: '10px' }}>
        <div className="signin-section reveal">
          <div className="signin-inner justify-center text-center">
            <div className="signin-card max-w-lg w-full mx-auto" style={{ borderTop: '3px solid var(--verified)' }}>
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-12 h-12 rounded-full" />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--verified)" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Welcome back, {user.name || 'User'}</h3>
              <p className="sub text-slate-400 mb-6">Active session: <strong>{user.email}</strong></p>
              
              <button 
                type="button" 
                className="btn-secondary w-full py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-all mb-4"
                onClick={onLogout}
              >
                Log Out
              </button>

              {/* History Section */}
              <div className="mt-8 text-left border-t border-white/5 pt-8 w-full">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Recent Audits
                </h4>
                
                {loadingHistory ? (
                  <div className="text-zinc-500 text-xs py-4 text-center">Loading scan history...</div>
                ) : userHistory.length === 0 ? (
                  <div className="text-zinc-500 text-xs py-6 text-center border border-dashed border-white/5 rounded-xl">
                    No recent scans found. Run a scan in the Interactive Scanner to save it to your history.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {userHistory.map((item) => {
                      const date = new Date(item.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const snippet = item.input_text
                        ? item.input_text.substring(0, 60) + (item.input_text.length > 60 ? '...' : '')
                        : 'Empty text';
                      
                      return (
                        <div 
                          key={item.session_id} 
                          className="p-3 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl transition-all cursor-pointer flex justify-between items-center group"
                          onClick={() => handleLoadPastAudit(item.session_id)}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="text-xs text-zinc-300 font-light truncate">{snippet}</p>
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500">
                              <span>{date}</span>
                              <span>•</span>
                              <span>{item.summary?.total_claims || 0} claims</span>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-900 text-zinc-300">
                              {item.summary?.trust_score ?? 0}%
                            </div>
                            <button className="text-[11px] text-purple-400 hover:text-purple-300 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 bg-transparent border-none p-0 cursor-pointer">
                              Load
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="signin" style={{ paddingTop: '10px' }}>
      <div className="signin-section reveal">
        <div className="signin-inner">
          <div className="signin-copy">
            <span className="eyebrow">Get started</span>
            <h2>Start grading your model's answers today</h2>
            <p>Free for your first 500 claims a month. Connect with your Google Account to check claims and save your history.</p>
            <ul>
              <li>
                <span className="checkmark">
                  <svg viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-6" stroke="#08080B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                Real-time claim scoring & history log
              </li>
              <li>
                <span className="checkmark">
                  <svg viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-6" stroke="#08080B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                Works with any model or provider
              </li>
              <li>
                <span className="checkmark">
                  <svg viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-6" stroke="#08080B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                Source-backed, not just a confidence guess
              </li>
            </ul>
          </div>

          <div className="signin-card">
            <h3>Welcome to Veritas</h3>
            <p className="sub">Sign in with a Google / Gmail account to run scans and view history.</p>
            
            {/* Google Sign In Element */}
            {clientId ? (
              <div id="google-signin-element" className="my-6 flex justify-center"></div>
            ) : (
              <div className="my-6 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 text-center">
                <p className="text-xs text-purple-300 font-light mb-1 leading-relaxed">
                  Native Google Sign-In is pending setup.
                </p>
                <button
                  type="button"
                  className="text-xs text-zinc-400 hover:text-white transition-all bg-transparent border-none cursor-pointer underline"
                  onClick={() => setShowConfig(true)}
                >
                  Click here to set your Client ID
                </button>
              </div>
            )}

            {/* Client ID Configuration Expandable Section */}
            <div className="mt-4 text-center">
              <button 
                type="button" 
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-all bg-transparent border-none cursor-pointer flex items-center gap-1.5 mx-auto"
                onClick={() => setShowConfig(!showConfig)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {clientId ? 'Configure Google Client ID' : 'Setup Google Client ID'}
              </button>

              {showConfig && (
                <div className="mt-3 p-4 rounded-xl bg-[#1e1e24]/50 border border-white/5 text-left animate-fadeIn">
                  <p className="text-[11px] text-zinc-400 mb-2 leading-relaxed">
                    Enter your Google OAuth Client ID. Make sure <strong>http://localhost:5173</strong> is allowed in your Google Console credentials under <i>Authorized JavaScript Origins</i>.
                  </p>
                  <div className="field mb-2">
                    <input
                      type="text"
                      placeholder="Paste Client ID here..."
                      value={clientId}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setClientId(val);
                        if (val) {
                          localStorage.setItem('veritas_google_client_id', val);
                        } else {
                          localStorage.removeItem('veritas_google_client_id');
                        }
                      }}
                      style={{ fontSize: '11px', padding: '8px 12px' }}
                    />
                  </div>
                  {clientId ? (
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Saved successfully! Re-initializing button...
                    </p>
                  ) : (
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Using simulation fallback.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-zinc-500 text-xs">Or use Gmail simulation</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <form onSubmit={handleGoogleSubmit}>
              <div className="field">
                <label htmlFor="google-email">Gmail Address</label>
                <input
                  id="google-email"
                  type="email"
                  placeholder="yourname@gmail.com"
                  required
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                />
              </div>

              {status && (
                <div className="text-xs p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4 animate-fadeIn">
                  {status}
                </div>
              )}

              <button type="submit" className="w-full py-2.5 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer border-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [auditData, setAuditData] = useState(null);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [agentMode, setAgentMode] = useState(false);
  const [showAgentPath, setShowAgentPath] = useState(false);

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('veritas_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('veritas_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('veritas_user');
    setAgentMode(false);
  };

  const handleRequireLogin = () => {
    const signinEl = document.getElementById('signin');
    if (signinEl) {
      signinEl.scrollIntoView({ behavior: 'smooth' });
    }
    setError('Please sign in or create an account to access the self-correcting Agent mode.');
    setTimeout(() => {
      setError((prev) => 
        prev === 'Please sign in or create an account to access the self-correcting Agent mode.' 
          ? '' 
          : prev
      );
    }, 6000);
  };

  const [userHistory, setUserHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchUserHistory = useCallback(async (email) => {
    if (!email) {
      setUserHistory([]);
      return;
    }
    setLoadingHistory(true);
    try {
      const response = await fetch(`http://localhost:5000/api/v1/user/audits?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        setUserHistory(data.audits || []);
      }
    } catch (err) {
      console.error('Error fetching user audits:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleLoadPastAudit = useCallback(async (sessionId) => {
    setPhase(PHASE.LOADING);
    setError('');
    setLoadingMsg('Retrieving saved audit...');
    try {
      const response = await fetch(`http://localhost:5000/api/v1/audit/${sessionId}`);
      const data = await response.json();
      if (response.ok) {
        setAuditData(data);
        setInputText(data.input_text || '');
        setPhase(PHASE.RESULTS);
        setTimeout(() => {
          document.getElementById('verdicts')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        setError(data.error || 'Failed to retrieve saved audit.');
        setPhase(PHASE.IDLE);
      }
    } catch (err) {
      setError('Error connecting to server to retrieve saved audit.');
      setPhase(PHASE.IDLE);
    }
  }, []);

  useEffect(() => {
    if (user && user.email) {
      fetchUserHistory(user.email);
    } else {
      setUserHistory([]);
    }
  }, [user, fetchUserHistory]);


  // Scroll Reveal Observer Effect
  useEffect(() => {
    const revealTargets = document.querySelectorAll('.reveal, .reveal-stagger');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealTargets.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [phase]);

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
      const requestOptions = { ...options };
      if (user && user.email) {
        requestOptions.userEmail = user.email;
      }

      const data = agentMode
        ? await agentAnalyze(text, requestOptions)
        : await analyzeText(text, requestOptions);
      setAuditData(data);
      setPhase(PHASE.RESULTS);

      // Refresh history
      if (user && user.email) {
        fetchUserHistory(user.email);
      }

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
  }, [agentMode, user, fetchUserHistory]);

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
    a.download = `veritas_audit_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [auditData]);

  const handleDownloadPDF = useCallback(() => {
    if (!auditData) return;
    generatePDFReport(auditData, inputText);
  }, [auditData, inputText]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#08080B]">
      <Header user={user} onLogout={handleLogout} />

      <main className="flex-1 pb-12 w-full relative z-10">
        {/* ===== HERO SECTION ===== */}
        <header className="hero">
          <div className="streaks">
            <svg viewBox="0 0 1400 900" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="blur1" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="38"/>
                </filter>
                <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#3FA672" stop-opacity="0.9"/>
                  <stop offset="100%" stop-color="#3FA672" stop-opacity="0"/>
                </linearGradient>
                <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#D9A441" stop-opacity="0.9"/>
                  <stop offset="100%" stop-color="#D9A441" stop-opacity="0"/>
                </linearGradient>
                <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#E15B5E" stop-opacity="0.9"/>
                  <stop offset="100%" stop-color="#E15B5E" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <g filter="url(#blur1)" transform="rotate(28 700 300)">
                <rect x="300" y="-200" width="60" height="900" fill="url(#gH)"/>
                <rect x="420" y="-200" width="45" height="900" fill="url(#gU)"/>
                <rect x="520" y="-200" width="70" height="900" fill="url(#gH)"/>
                <rect x="640" y="-200" width="40" height="900" fill="url(#gV)"/>
                <rect x="740" y="-200" width="55" height="900" fill="url(#gU)"/>
                <rect x="860" y="-200" width="65" height="900" fill="url(#gH)"/>
                <rect x="980" y="-200" width="40" height="900" fill="url(#gV)"/>
                <rect x="1080" y="-200" width="50" height="900" fill="url(#gU)"/>
              </g>
            </svg>
          </div>
          <div className="hero-fade"></div>

          <div className="wrap">
            <span className="eyebrow hero-anim d1">Fact-level review for LLM output</span>
            <h1 className="hero-anim d2">Your model's answers,<br/>double-checked.</h1>
            <p className="hero-sub hero-anim d3">Veritas scans output from GPT, Claude, Gemini and your own models, checks every factual claim against sources, and grades it before your users ever see it.</p>
            <div className="hero-actions hero-anim d4">
              <a className="btn-primary" href="#input-section" onClick={(e) => {
                e.preventDefault();
                document.getElementById('input-section')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}><path d="M12 2a1 1 0 011 1v9.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L11 12.586V3a1 1 0 011-1zM5 20a1 1 0 011-1h12a1 1 0 110 2H6a1 1 0 01-1-1z"/></svg>
                Run a free scan
              </a>
              <a className="btn-secondary" href="#method" onClick={(e) => {
                e.preventDefault();
                document.getElementById('method')?.scrollIntoView({ behavior: 'smooth' });
              }}>View a sample report</a>
            </div>
            <div className="hero-meta hero-anim d5">
              <span>v1.0</span> · <span>Works with GPT, Claude, Gemini</span> · <span>API available</span>
            </div>

            <ManuscriptDemo />

            <div className="hero-foot hero-anim d7">Veritas for Slack <a href="#signin" onClick={(e) => {
              e.preventDefault();
              document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth' });
            }}>Join waitlist →</a></div>
          </div>
        </header>

        {/* ===== VERDICTS SECTION ===== */}
        <section id="verdicts">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">The three verdicts</span>
              <h2>No single score — a verdict per claim</h2>
              <p>Veritas breaks output into individual factual claims and grades each one on its own, instead of one confidence number for a whole response.</p>
            </div>
            <div className="verdicts reveal-stagger">
              <div className="verdict-card v">
                <span className="mono">01 — Verified</span>
                <h3>Backed by a source</h3>
                <p>The claim matches at least one retrieved, citable source with no material contradiction. Safe to ship as-is.</p>
              </div>
              <div className="verdict-card u">
                <span className="mono">02 — Uncertain</span>
                <h3>No confident source</h3>
                <p>Sources disagree, are outdated, or don't exist for this claim. Flagged for human review before it reaches a user.</p>
              </div>
              <div className="verdict-card h">
                <span className="mono">03 — Hallucinated</span>
                <h3>Contradicted or invented</h3>
                <p>The claim is fabricated or directly conflicts with reliable sources. Blocked by default in production mode.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== METHOD SECTION ===== */}
        <section id="method">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Method</span>
              <h2>From raw output to a graded transcript</h2>
              <p>Three steps, no configuration required to start.</p>
            </div>
            <div className="how reveal-stagger">
              <div className="how-step">
                <span className="num">01</span>
                <h3>Send the response</h3>
                <p>Paste text, upload a transcript, or connect via API — Veritas works with output from any model, including your own fine-tunes.</p>
              </div>
              <div className="how-step">
                <span className="num">02</span>
                <h3>Claims get isolated</h3>
                <p>Each factual statement is extracted on its own, separated from opinion, instruction, and filler language.</p>
              </div>
              <div className="how-step">
                <span className="num">03</span>
                <h3>Every claim is checked</h3>
                <p>Claims are checked against live and cached sources and returned with a verdict, a confidence figure, and the source used.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== ANALYSIS TOOL / SCANNER ===== */}
        <div id="input-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-left relative z-20 border-t border-b border-white/5 bg-[#0a0a0f]/40">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <span className="eyebrow">Interactive Scanner</span>
            <h2 className="text-3xl font-semibold text-white tracking-tight mb-3">Double-check output in real-time</h2>
            <p className="text-zinc-400 text-sm font-light">Paste LLM responses or upload text files below. Choose your verification tier and watch Veritas analyze claims in real-time.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start min-h-[500px]">
            {/* Left Column: Input and options */}
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
              <div className="mb-6 relative z-30 animate-fadeInUp">
                {/* Agent Mode Toggle */}
                <AgentToggle
                  agentMode={agentMode}
                  onToggle={() => setAgentMode(!agentMode)}
                  disabled={phase === PHASE.LOADING}
                  isLoggedIn={!!user}
                  onRequireLogin={handleRequireLogin}
                />

                <div className="mt-6">
                  <InputPanel
                    onAnalyze={handleAnalyze}
                    isLoading={phase === PHASE.LOADING}
                    onClear={handleClear}
                    initialText={inputText}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Status & Results */}
            <div className="flex flex-col w-full h-full overflow-hidden">
              {/* IDLE State: Tagline & Placeholder */}
              {phase === PHASE.IDLE && (
                <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[600px] bg-gradient-to-br from-[#111118]/80 to-[#0d0d14]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group animate-fadeIn">
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
                    <h3 className="text-2xl font-medium text-white mb-4 tracking-tight">Veritas Verification Engine</h3>
                    <p className="text-slate-400 text-[14px] max-w-sm leading-relaxed font-light">
                      <span className="text-purple-400 font-semibold">Did you know?</span> Over 80% of enterprise LLM deployments suffer from subtle factual drift. Veritas automatically grounds every claim against primary sources to ensure irrefutable integrity.
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
                <div className="flex flex-col items-center justify-center h-full min-h-[600px] bg-gradient-to-br from-[#111118]/80 to-[#0d0d14]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] py-20 px-8 shadow-2xl relative animate-fadeIn">
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

                  <div className="text-center bg-[#111118] border border-white/5 rounded-2xl p-6 shadow-xl max-w-md w-full relative overflow-hidden">
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
                    <p className="text-slate-500 text-[13px] mt-1.5 font-light">
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
                <div className="h-full flex flex-col space-y-8 animate-fade-up overflow-y-auto pr-2 pb-12">
                  {/* Header / Actions Card */}
                  <div className="verity-panel bg-gradient-to-r from-[#111118] to-[#0d0d14] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
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
            <div className="verity-panel mt-12 bg-gradient-to-br from-[#111118] to-[#0d0d14] border border-white/10 rounded-2xl p-8 shadow-2xl animate-fadeInUp w-full max-w-7xl mx-auto">
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
                  <p className="text-sm text-slate-400 mt-1 font-light">
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

        {/* ===== GET STARTED / SIGN IN ===== */}
        <SigninSection 
          user={user} 
          onLogin={handleLogin} 
          onLogout={handleLogout} 
          userHistory={userHistory} 
          loadingHistory={loadingHistory} 
          handleLoadPastAudit={handleLoadPastAudit} 
        />
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap footer-inner">
          <span>© 2026 Veritas. Fact-level review for LLM output.</span>
          <span>Method · Verdicts · Pricing · Docs</span>
        </div>
      </footer>

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
