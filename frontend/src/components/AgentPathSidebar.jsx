import React, { useState, useEffect, useRef } from 'react';

const NODE_CONFIG = {
  miner: {
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.25)',
    label: 'Miner',
    icon: '⛏️',
  },
  researcher: {
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.1)',
    border: 'rgba(168, 85, 247, 0.25)',
    label: 'Researcher',
    icon: '📚',
  },
  auditor: {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.25)',
    label: 'Auditor',
    icon: '⚖️',
  },
  fixer: {
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.25)',
    label: 'Fixer',
    icon: '🔧',
  },
  fallback: {
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.1)',
    border: 'rgba(100, 116, 139, 0.25)',
    label: 'System',
    icon: '⚙️',
  },
};

export default function AgentPathSidebar({ thinkingLog, isOpen, onClose, iterationsUsed }) {
  const [expandedSteps, setExpandedSteps] = useState(new Set());
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new steps appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinkingLog]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const toggleStep = (stepIndex) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) next.delete(stepIndex);
      else next.add(stepIndex);
      return next;
    });
  };

  if (!isOpen) return null;

  const log = thinkingLog || [];

  // Detect iteration boundaries for visual grouping
  const getIterationLabel = (step, index) => {
    if (step.action && step.action.includes('Retry iteration')) {
      const match = step.action.match(/iteration (\d+)/);
      return match ? `Loop ${match[1]}` : 'Retry';
    }
    return null;
  };

  return (
    <>
      {/* Backdrop */}
      <div className="agent-sidebar-backdrop" onClick={onClose} />

      {/* Sidebar */}
      <aside className="agent-sidebar" role="complementary" aria-label="Agent Thinking Path">
        {/* Header */}
        <div className="agent-sidebar-header">
          <div className="agent-sidebar-title-row">
            <div className="agent-sidebar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
            </div>
            <div>
              <h3 className="agent-sidebar-title">Agent Thinking Path</h3>
              <p className="agent-sidebar-subtitle">
                {log.length} steps
                {iterationsUsed > 0 && ` · ${iterationsUsed} iteration${iterationsUsed > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button className="agent-sidebar-close" onClick={onClose} aria-label="Close sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Node Legend */}
        <div className="agent-sidebar-legend">
          {Object.entries(NODE_CONFIG).filter(([k]) => k !== 'fallback').map(([key, cfg]) => (
            <span key={key} className="agent-legend-item" style={{ color: cfg.color }}>
              <span className="agent-legend-dot" style={{ backgroundColor: cfg.color }} />
              {cfg.label}
            </span>
          ))}
        </div>

        {/* Timeline */}
        <div className="agent-sidebar-timeline" ref={scrollRef}>
          {log.length === 0 ? (
            <div className="agent-sidebar-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <p>Agent steps will appear here during analysis...</p>
            </div>
          ) : (
            log.map((step, index) => {
              const nodeKey = step.node || 'fallback';
              const config = NODE_CONFIG[nodeKey] || NODE_CONFIG.fallback;
              const isExpanded = expandedSteps.has(index);
              const iterLabel = getIterationLabel(step, index);
              const isLast = index === log.length - 1;

              return (
                <div key={index}>
                  {/* Iteration boundary marker */}
                  {iterLabel && (
                    <div className="agent-timeline-loop-marker">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                      <span>{iterLabel}</span>
                    </div>
                  )}

                  {/* Timeline Step */}
                  <div
                    className={`agent-timeline-step ${isLast ? 'agent-timeline-step--last' : ''}`}
                    style={{ '--node-color': config.color, animationDelay: `${index * 0.05}s` }}
                  >
                    {/* Connector line */}
                    {!isLast && <div className="agent-timeline-connector" style={{ backgroundColor: config.border }} />}

                    {/* Dot */}
                    <div className="agent-timeline-dot" style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.color}40` }}>
                      {isLast && <div className="agent-timeline-dot-pulse" style={{ borderColor: config.color }} />}
                    </div>

                    {/* Content */}
                    <div className="agent-timeline-content" onClick={() => step.detail && toggleStep(index)}>
                      <div className="agent-timeline-header">
                        <span className="agent-timeline-node-badge" style={{ color: config.color, backgroundColor: config.bg, borderColor: config.border }}>
                          {config.icon} {config.label}
                        </span>
                        <span className="agent-timeline-step-num">#{step.step}</span>
                      </div>

                      <p className="agent-timeline-action">{step.action}</p>

                      {/* Expandable detail */}
                      {step.detail && (
                        <>
                          <button className="agent-timeline-expand-btn" aria-expanded={isExpanded}>
                            <svg
                              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            {isExpanded ? 'Less' : 'Details'}
                          </button>
                          {isExpanded && (
                            <div className="agent-timeline-detail animate-fadeIn">
                              {step.detail}
                            </div>
                          )}
                        </>
                      )}

                      {/* Timestamp */}
                      {step.ts && (
                        <span className="agent-timeline-ts">
                          {new Date(step.ts).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
