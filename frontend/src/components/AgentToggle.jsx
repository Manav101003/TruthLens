import React from 'react';

export default function AgentToggle({ agentMode, onToggle, disabled, isLoggedIn, onRequireLogin }) {
  return (
    <div className="agent-toggle-container">
      <div className="agent-toggle-wrapper">
        {/* Standard Tab */}
        <button
          type="button"
          className={`agent-toggle-tab ${!agentMode ? 'active' : ''}`}
          onClick={() => {
            if (agentMode && !disabled) {
              onToggle();
            }
          }}
          disabled={disabled}
          title="Fast deterministic verification via Wikipedia & CrossRef"
        >
          <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>Standard</span>
        </button>

        {/* Agent Tab */}
        <button
          type="button"
          className={`agent-toggle-tab ${agentMode ? 'active' : ''}`}
          onClick={() => {
            if (!agentMode && !disabled) {
              onToggle();
            }
          }}
          disabled={disabled}
          title="Agent Mode: Self-correcting LangGraph pipeline with retry loops"
        >
          <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span>Agent</span>
          {agentMode && <span className="agent-badge-pulse">AI</span>}
        </button>
      </div>

      <p className="agent-toggle-description">
        {agentMode
          ? '🤖 Self-correcting pipeline with LLM auditing & auto-fix'
          : '⚡ Fast deterministic verification via Wikipedia & CrossRef'
        }
      </p>
    </div>
  );
}
