import React from 'react';

export default function AgentToggle({ agentMode, onToggle, disabled }) {
  return (
    <div className="agent-toggle-container">
      <div className="agent-toggle-wrapper">
        {/* Standard Mode Label */}
        <span className={`agent-toggle-label ${!agentMode ? 'agent-toggle-label--active' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Standard
        </span>

        {/* Toggle Switch */}
        <button
          className={`agent-toggle-switch ${agentMode ? 'agent-toggle-switch--active' : ''}`}
          onClick={onToggle}
          disabled={disabled}
          aria-label={agentMode ? 'Switch to Standard Mode' : 'Switch to Agent Mode'}
          title={agentMode
            ? 'Agent Mode: Self-correcting LangGraph pipeline with retry loops'
            : 'Standard Mode: Direct Wikipedia + CrossRef verification'
          }
        >
          <div className="agent-toggle-track">
            <div className="agent-toggle-thumb">
              {agentMode && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2a4 4 0 0 1 4 4c0 1.95-2 4-4 4s-4-2.05-4-4a4 4 0 0 1 4-4z" />
                  <path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" />
                </svg>
              )}
            </div>
          </div>
        </button>

        {/* Agent Mode Label */}
        <span className={`agent-toggle-label ${agentMode ? 'agent-toggle-label--active agent-toggle-label--agent' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Agent
          {agentMode && <span className="agent-badge-pulse">AI</span>}
        </span>
      </div>

      {/* Description */}
      <p className="agent-toggle-description">
        {agentMode
          ? '🤖 Self-correcting pipeline with LLM auditing & auto-fix'
          : '⚡ Fast deterministic verification via Wikipedia & CrossRef'
        }
      </p>
    </div>
  );
}
