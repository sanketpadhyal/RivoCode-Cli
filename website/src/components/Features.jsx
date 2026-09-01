import React from 'react';
import {
  Code2,
  Layers,
  FileCheck2,
  Terminal,
  Cpu,
  Boxes,
} from 'lucide-react';

const Features = () => {
  const featuresList = [
    {
      Icon: Code2,
      color: '#34C759',
      title: 'Tree-Sitter AST & Code-Map',
      desc: 'Builds an in-memory abstract syntax tree map across 40+ languages to resolve classes, functions, and cross-file imports with zero context bloat.',
    },
    {
      Icon: Layers,
      color: '#AF52DE',
      title: 'Autonomous Subagent Swarms',
      desc: 'Spawns specialized parallel subagents to conduct research, AST searches, and test suites concurrently in isolated working threads.',
    },
    {
      Icon: FileCheck2,
      color: '#0A84FF',
      title: 'Multi-File Atomic Refactoring',
      desc: 'Modifies multiple project files in a single pass with clean syntax-highlighted unified diff previews and rollback guarantees.',
    },
    {
      Icon: Terminal,
      color: '#FF9F0A',
      title: 'Integrated Shell & Self-Healing',
      desc: 'Executes builds, linters, and tests directly in your terminal, automatically intercepting compiler errors and self-correcting logic.',
    },
    {
      Icon: Cpu,
      color: '#34C759',
      title: 'Zero-Latency Terminal UI',
      desc: 'Built on React 19 and Yoga Layout to render fluid 60FPS streaming tokens, interactive keyboard dialogues, and TrueColor markdown.',
    },
    {
      Icon: Boxes,
      color: '#AF52DE',
      title: 'Model Context Protocol (MCP)',
      desc: 'Connect external tools, databases, and custom skills via native Anthropic MCP server support and built-in web search.',
    },
  ];

  return (
    <section id="features" className="features-section">
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title">Core Capabilities</h2>
          <p className="section-subtitle">
            Built from the ground up for speed, full codebase awareness, and autonomous execution.
          </p>
        </div>

        <div className="features-grid">
          {featuresList.map((feat, index) => {
            const Icon = feat.Icon;
            return (
              <div key={index} className="feature-card">
                <div className="feature-icon-wrapper" style={{ color: feat.color, backgroundColor: `${feat.color}15` }}>
                  <Icon size={24} strokeWidth={2.2} />
                </div>
                <h3 className="feature-card-title">{feat.title}</h3>
                <p className="feature-card-desc">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
