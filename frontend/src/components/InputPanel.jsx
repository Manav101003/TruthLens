import React, { useState, useCallback, useRef } from 'react';
import { uploadDocument } from '../api/auditApi';

const SAMPLE_TEXT = `India's GDP grew by 8.4% in 2023, making it the fastest-growing major economy in the world. The Eiffel Tower, located in Berlin, Germany, was constructed between 1887 and 1889. NASA was founded in 1958 by the United States government to advance space exploration. Albert Einstein won the Nobel Prize in Physics in 1921 for his discovery of the law of photoelectric effect. The population of Australia surpassed 500 million people in 2022, driven by high immigration rates. The Great Wall of China stretches approximately 21,196 kilometres, making it the longest man-made structure on Earth. Apple Inc. was founded in a garage in Cupertino, California, in 1976 by Steve Jobs, Steve Wozniak, and Ronald Wayne.`;

const MAX_WORDS = 5000;
const MIN_WORDS = 10;
const ACCEPTED_TYPES = '.pdf,.docx,.doc,.txt,.md,.rtf';
const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'doc', 'txt', 'md', 'rtf'];

export default function InputPanel({ onAnalyze, isLoading, onClear }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [referenceDocumentText, setReferenceDocumentText] = useState('');
  const [userTier, setUserTier] = useState('enterprise');
  const fileInputRef = useRef(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const remainingWords = MAX_WORDS - wordCount;

  const handleTextChange = useCallback((e) => {
    const value = e.target.value;
    const wc = value.trim() ? value.trim().split(/\s+/).length : 0;
    if (wc <= MAX_WORDS) {
      setText(value);
      setError('');
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    if (wordCount < MIN_WORDS) {
      setError(`Please enter at least ${MIN_WORDS} words of LLM-generated text.`);
      return;
    }
    setError('');
    onAnalyze(text, {
      referenceDocument: referenceDocumentText,
      userTier
    });
  }, [text, wordCount, referenceDocumentText, userTier, onAnalyze]);

  const handleLoadSample = useCallback(() => {
    setText(SAMPLE_TEXT);
    setError('');
  }, []);

  const handleClear = useCallback(() => {
    setText('');
    setError('');
    setUploadedFile(null);
    setReferenceDocumentText('');
    onClear();
  }, [onClear]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAnalyze();
    }
  }, [handleAnalyze]);

  // ----- File Upload Logic -----
  const processFile = useCallback(async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type: .${ext}. Allowed: ${ACCEPTED_EXTENSIONS.map(e => `.${e}`).join(', ')}`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const result = await uploadDocument(file);
      if (result.success && result.text) {
        // Put text in textarea so it can be analyzed
        setText(result.text);
        // Also keep as reference document for internal grounding
        setReferenceDocumentText(result.text);
        setUploadedFile({
          name: result.metadata.fileName,
          size: result.metadata.fileSize,
          type: result.metadata.fileType,
          truncated: result.metadata.truncated,
          extractedLength: result.metadata.extractedLength,
        });
        setError('');
      } else {
        setError('Failed to extract text from the uploaded document.');
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to process the uploaded document.';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so the same file can be re-uploaded
    e.target.value = '';
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const getFileIcon = (type) => {
    if (type === '.pdf') return '📕';
    if (type === '.docx' || type === '.doc') return '📘';
    return '📄';
  };

  return (
    <div className="verity-panel py-10 px-14 animate-fadeInUp rounded-2xl border border-white/5 bg-transparent">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <h2 className="verity-text text-lg font-semibold text-white">Input Text</h2>
            <p className="verity-text-secondary text-xs text-slate-400">Paste LLM-generated content or upload a document</p>
          </div>
        </div>
      </div>

      {/* Vertical Stacked Layout */}
      <div className="flex flex-col gap-8 mb-6">
        {/* Top: Upload Zone */}
        <div className="w-full">
          <div
            className={`relative w-full flex flex-col items-center justify-center min-h-[160px] rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden group
              ${isDragging ? 'border-purple-500 bg-purple-500/10 scale-[1.02]' : 'border-[#3f3f46] hover:border-purple-400/50 bg-[#1e1e24] hover:bg-[#25252b]'}
              ${isUploading ? 'opacity-80 pointer-events-none' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            {/* Subtle background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileSelect}
              className="hidden"
              disabled={isLoading || isUploading}
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-4 relative z-10">
                <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin shadow-[0_0_15px_rgba(139,92,246,0.3)]" />
                <p className="text-sm font-medium text-slate-300 tracking-wide">Extracting document...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 relative z-10">
                <div className="w-14 h-14 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-purple-400 group-hover:bg-purple-500/10 group-hover:border-purple-500/30 transition-all duration-300 shadow-lg">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-[15px] text-slate-200">
                    <span className="text-purple-400 font-semibold group-hover:underline decoration-purple-400/50 underline-offset-4">Click to browse</span> or drag & drop
                  </p>
                  <p className="text-[13px] text-slate-500 mt-1 font-medium">PDF, DOCX, TXT — max 10MB</p>
                </div>
              </div>
            )}
          </div>

          {/* Uploaded File Badge */}
          {uploadedFile && (
            <div className="mt-3 flex items-center bg-[#1e1e24] border border-[#3f3f46] rounded-xl p-3 shadow-md animate-fadeIn">
              <div className="p-2 bg-slate-800 rounded-lg mr-3">
                <span className="text-lg flex items-center justify-center">{getFileIcon(uploadedFile.type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium truncate">{uploadedFile.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-slate-500 font-mono">{(uploadedFile.size / 1024).toFixed(0)}KB</p>
                  <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                  <p className="text-[11px] text-slate-500 font-mono">{uploadedFile.extractedLength.toLocaleString()} chars</p>
                  {uploadedFile.truncated && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-amber-500/50"></span>
                      <span className="text-[11px] text-amber-400 font-medium bg-amber-400/10 px-1.5 rounded">truncated</span>
                    </>
                  )}
                </div>
              </div>
              <button
                className="ml-3 p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                onClick={(e) => { e.stopPropagation(); setUploadedFile(null); setText(''); setReferenceDocumentText(''); }}
                aria-label="Remove uploaded file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/5"></div>
          <span className="text-xs font-medium tracking-widest uppercase text-slate-500">OR PASTE TEXT</span>
          <div className="flex-1 h-px bg-white/5"></div>
        </div>

        {/* Bottom: Textarea */}
        <div className="flex flex-col w-full relative group">
          <textarea
            id="input-textarea"
            className="w-full min-h-[220px] bg-[#1e1e24] text-slate-200 border border-[#3f3f46] rounded-2xl p-5 outline-none resize-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/50 transition-all duration-300 placeholder:text-slate-600 shadow-inner text-[15px] leading-relaxed font-sans no-scrollbar"
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Paste your LLM-generated text here... (e.g., ChatGPT, Claude, Gemini output)"
            disabled={isLoading}
          />

          {/* Word Counter */}
          <div className="flex items-center justify-between mt-3 px-2">
            <div className="text-[13px] font-medium">
              {wordCount < MIN_WORDS && wordCount > 0 ? (
                <span className="text-amber-400 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Need {MIN_WORDS - wordCount} more words
                </span>
              ) : (
                <span className="text-slate-500">Ready to analyze</span>
              )}
            </div>
            <span className={`text-[12px] font-mono font-medium px-2 py-0.5 rounded-md border ${remainingWords < 200 ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-slate-400 bg-slate-800 border-slate-700'}`}>
              {wordCount.toLocaleString()} / {MAX_WORDS.toLocaleString()} words
            </span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg px-4 py-2.5 animate-fadeIn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      )}

      {/* Action Buttons & Tier Selection */}
      <div className="flex flex-col gap-4 mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="analyze-btn"
            className="btn-primary flex items-center gap-2 relative shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all duration-300"
            onClick={handleAnalyze}
            disabled={isLoading || wordCount < MIN_WORDS}
          >
            {/* Subtle pulse effect under the button */}
            <span className="absolute inset-0 rounded-lg animate-ping opacity-20 bg-purple-500" style={{ animationDuration: '3s' }}></span>
            
            <span className="relative flex items-center gap-2 z-10">
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  Analyze
                </>
              )}
            </span>
          </button>

          <button
            id="sample-btn"
            className="btn-secondary flex items-center gap-2"
            onClick={handleLoadSample}
            disabled={isLoading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Load Sample
          </button>

          {text.length > 0 && (
            <button
              id="clear-btn"
              className="btn-danger flex items-center gap-2"
              onClick={handleClear}
              disabled={isLoading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Clear
            </button>
          )}
        </div>
        
        <div className="w-full sm:w-[380px]">
          <div className="relative">
            <select 
              className="tier-dropdown w-full appearance-none bg-[#1e1e24] border border-[#3f3f46] text-slate-200 text-sm font-medium rounded-xl px-4 py-3 pr-10 outline-none cursor-pointer hover:border-purple-500/40 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all duration-300"
              value={userTier}
              onChange={(e) => setUserTier(e.target.value)}
              disabled={isLoading}
            >
              <option value="basic">⚡ Basic — Wikipedia verification</option>
              <option value="business">🔍 Business — Web search + Auto-fix</option>
              <option value="enterprise">🚀 Enterprise — Full engine</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
