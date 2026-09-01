import React, { useState } from 'react';
import {
  Layers,
  Terminal,
} from 'lucide-react';

const modesList = [
  {
    id: 'plan',
    flag: '--plan',
    title: 'PLAN Mode',
    badge: 'Architectural Blueprint',
    badgeColor: '#0A84FF',
    tagline: 'Deep architectural roadmaps and multi-phase planning before modifying files.',
    desc: 'PLAN mode conducts an in-depth codebase audit, builds a dependency DAG, and constructs a step-by-step implementation strategy for complex refactors, new microservices, or API migrations.',
    example: 'rivo --plan "Migrate auth service from Monolith to microservice"',
    bestFor: 'Large architectural refactors, new feature design, complex multi-package monorepo migrations',
    tokens: 'Extended reasoning tokens with structured markdown roadmap artifacts',
  },
  {
    id: 'lite',
    flag: '--lite',
    title: 'LITE Mode',
    badge: 'High-Speed Single-File Edit',
    badgeColor: '#34C759',
    tagline: 'Ultra-fast execution optimized for rapid fixes, linting, and targeted edits.',
    desc: 'LITE mode restricts reasoning overhead to deliver sub-second token generation for quick function fixes, bug repairs, documentation updates, and single-file modifications.',
    example: 'rivo --lite "Fix null pointer exception in user.service.ts:42"',
    bestFor: 'Bug fixes, typing errors, unit tests, fast script modifications',
    tokens: 'Low token consumption, fastest response latency',
  },
  {
    id: 'max',
    flag: '--max',
    title: 'MAX Mode',
    badge: 'Deep Multi-Subagent Reasoning',
    badgeColor: '#AF52DE',
    tagline: 'Maximum chain-of-thought depth with autonomous subagent swarm spawning.',
    desc: 'MAX mode unleashes RivoCode’s most exhaustive reasoning loop, spawning multiple parallel subagents to audit edge cases, stress test logic, and execute self-healing test suites.',
    example: 'rivo --max "Implement distributed raft consensus with automated failover tests"',
    bestFor: 'Mission-critical algorithms, high-concurrency systems, security audits',
    tokens: 'Maximum reasoning depth with parallel worker agents',
  },
  {
    id: 'interactive',
    flag: 'rivo (default)',
    title: 'Interactive Chat Mode',
    badge: 'Terminal Conversational Workspace',
    badgeColor: '#FF9F0A',
    tagline: 'Conversational terminal workspace with slash commands, file attachment, and model switching.',
    desc: 'Launch a full-screen interactive OpenTUI session. Attach specific files with `/attach`, switch model providers with `/model`, inspect token history, and chat continuously with your codebase.',
    example: 'rivo',
    bestFor: 'Interactive pair programming, exploration, continuous feature prototyping',
    tokens: 'Dynamic streaming with Token Compactor memory preservation',
  },
];

const Modes = () => {
  const [selectedMode, setSelectedMode] = useState('plan');

  const active = modesList.find((m) => m.id === selectedMode) || modesList[0];

  return (
    <section id="modes" className="modes-section">
      <div className="section-container">
        {/* Header */}
        <div className="section-header">
          <div className="section-eyebrow">
            <Layers size={14} className="text-purple" />
            <span>Tailored Execution Strategies</span>
          </div>
          <h2 className="section-title">Execution Modes for Every Task</h2>
          <p className="section-subtitle">
            Switch effortlessly between instant lightweight fixes, deep architectural planning,
            and maximal reasoning swarms.
          </p>
        </div>

        {/* Mode Selector Cards */}
        <div className="modes-cards-grid">
          {modesList.map((mode) => {
            const isSelected = selectedMode === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`mode-card ${isSelected ? 'active' : ''}`}
                style={{
                  borderColor: isSelected ? mode.badgeColor : 'rgba(255,255,255,0.06)',
                }}
              >
                <div className="mode-card-header">
                  <span
                    className="mode-flag-badge"
                    style={{
                      backgroundColor: `${mode.badgeColor}15`,
                      color: mode.badgeColor,
                      borderColor: `${mode.badgeColor}35`,
                    }}
                  >
                    <code>{mode.flag}</code>
                  </span>
                  <span className="mode-badge-title">{mode.badge}</span>
                </div>

                <h3 className="mode-card-title">{mode.title}</h3>
                <p className="mode-card-tagline">{mode.tagline}</p>

                <div className="mode-command-snippet">
                  <Terminal size={12} />
                  <code>{mode.example}</code>
                </div>

                {isSelected && (
                  <div className="mode-active-indicator" style={{ backgroundColor: mode.badgeColor }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Mode Deep-Dive Detail Box */}
        <div className="mode-detail-box">
          <div className="mode-detail-inner">
            <div className="detail-col-left">
              <span
                className="mode-detail-badge"
                style={{
                  backgroundColor: `${active.badgeColor}15`,
                  color: active.badgeColor,
                  borderColor: `${active.badgeColor}35`,
                }}
              >
                {active.title} • {active.flag}
              </span>
              <h3 className="mode-detail-heading">{active.tagline}</h3>
              <p className="mode-detail-desc">{active.desc}</p>
            </div>

            <div className="detail-col-right">
              <div className="mode-spec-box">
                <div className="spec-row">
                  <span className="spec-title">Best Suited For:</span>
                  <span className="spec-value">{active.bestFor}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-title">Reasoning Profile:</span>
                  <span className="spec-value">{active.tokens}</span>
                </div>
                <div className="spec-row">
                  <span className="spec-title">Launch Command:</span>
                  <code className="spec-code">{active.example}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Modes;
