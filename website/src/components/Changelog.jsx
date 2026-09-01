import React, { useState } from 'react';
import {
  Tag,
  GitMerge,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  FileCode2,
  Terminal,
  Zap,
  Boxes,
  Download,
  ExternalLink,
} from 'lucide-react';

const highlights = [
  {
    icon: Layers,
    color: '#AF52DE',
    title: 'Multi-Subagent Swarm Engine',
    desc: 'Autonomous worker spawning (`spawn-agents`, `spawn-agent-inline`) for parallel codebase research, AST analysis, and test verification.',
  },
  {
    icon: Cpu,
    color: '#0A84FF',
    title: 'Tree-Sitter 2.0 WASM Indexer',
    desc: 'Compiles 40+ language grammars to WebAssembly for instant sub-18ms AST symbol mapping and cross-file import resolution.',
  },
  {
    icon: Terminal,
    color: '#34C759',
    title: 'OpenTUI + React 19 Engine',
    desc: 'Hardware-accelerated ANSI terminal UI with 60FPS fluid token streaming, Markdown code blocks, and interactive dialogs.',
  },
  {
    icon: Boxes,
    color: '#FF9F0A',
    title: 'Model Context Protocol (MCP)',
    desc: 'Native integration with Anthropic MCP servers, custom workspace skills, and external API tool brokers.',
  },
];

const techUpdates = [
  { label: '@opentui/core', version: '^1.4.2', desc: 'Zero-latency React 19 terminal reconciler' },
  { label: 'web-tree-sitter', version: '^0.22.6', desc: 'WASM syntax parsing & symbol graphs' },
  { label: 'yoga-layout-prebuilt', version: '^1.10.0', desc: 'Flexbox layout engine for terminal frames' },
  { label: '@modelcontextprotocol/sdk', version: '^1.0.4', desc: 'MCP server and client tool adapter' },
];

const binaryPackages = [
  { name: 'rivocode-darwin-arm64', arch: 'Apple Silicon (M1/M2/M3/M4)', size: '~34 MB' },
  { name: 'rivocode-darwin-x64', arch: 'macOS Intel (x86_64)', size: '~38 MB' },
  { name: 'rivocode-linux-x64', arch: 'Linux glibc / musl x86_64', size: '~36 MB' },
  { name: 'rivocode-linux-arm64', arch: 'Linux & Android Termux AArch64', size: '~33 MB' },
  { name: 'rivocode-win32-x64.exe', arch: 'Windows 10 / 11 x64', size: '~39 MB' },
];

const Changelog = () => {
  const [open, setOpen] = useState(false);

  return (
    <section className="changelog-section" id="changelog">
      <div className="section-container">
        {/* Header */}
        <div className="changelog-header">
          <div className="changelog-title-row">
            <div className="changelog-release-badge">
              <Tag size={12} strokeWidth={2.5} />
              Latest Major Release
            </div>
            <span className="changelog-version-label">v3.0.0</span>
          </div>

          <h2 className="changelog-title">
            RivoCode CLI <span className="gradient-text">v3.0.0</span>
          </h2>
          <p className="changelog-subtitle">
            Autonomous Multi-Subagent Swarms, Tree-Sitter 2.0 &amp; Cross-Platform Native Binaries
          </p>

          <div className="changelog-meta-row">
            <span className="changelog-meta-tag">
              <GitMerge size={12} strokeWidth={2.5} />
              e7f390a
            </span>
            <span className="changelog-meta-tag green">
              <Sparkles size={12} strokeWidth={2.5} />
              Major Release
            </span>
            <span className="changelog-meta-tag">npm v3.0.0</span>
            <span className="changelog-meta-dot">Production Ready</span>
          </div>

          <p className="changelog-lead">
            RivoCode CLI v3.0.0 is a complete overhaul of the autonomous terminal coding assistant.
            Introducing parallel multi-subagent orchestration, WebAssembly Tree-Sitter 2.0 AST
            code-mapping, OpenTUI React 19 reconciliation, atomic multi-file patching, and universal
            cross-platform binaries for macOS, Linux, Windows, Android (Termux), and iOS.
          </p>
        </div>

        {/* Highlight Cards */}
        <div className="changelog-highlights-grid">
          {highlights.map((h) => {
            const Icon = h.icon;
            return (
              <div className="changelog-highlight-card" key={h.title}>
                <div
                  className="changelog-highlight-icon"
                  style={{ background: `${h.color}18`, border: `1px solid ${h.color}30` }}
                >
                  <Icon size={20} strokeWidth={2} style={{ color: h.color }} />
                </div>
                <h3 className="changelog-highlight-title">{h.title}</h3>
                <p className="changelog-highlight-desc">{h.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Expandable Changelog Body */}
        <div className="changelog-expand-wrapper">
          <button
            className="changelog-expand-btn"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <span>{open ? 'Collapse full release notes' : 'View full v3.0.0 changelog & architecture updates'}</span>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {open && (
            <div className="changelog-body">
              {/* Swarm Engine */}
              <div className="changelog-group">
                <div className="changelog-group-header purple">
                  <Layers size={16} strokeWidth={2.5} />
                  Autonomous Multi-Subagent Swarm (`agent-runtime`)
                </div>
                <ul className="changelog-list">
                  <li>
                    Added inline subagent spawning (<code>spawn-agent-inline</code>) and parallel worker swarms (<code>spawn-agents</code>) enabling concurrent codebase research, AST symbol search, and test execution.
                  </li>
                  <li>
                    Isolated agent working environments prevent context pollution while allowing consolidated result streaming into the main terminal conversation.
                  </li>
                  <li>
                    Equipped with automatic retry loops, self-correcting error recovery, and goal progress trackers.
                  </li>
                </ul>
              </div>

              {/* Tree-Sitter AST */}
              <div className="changelog-group">
                <div className="changelog-group-header blue">
                  <Cpu size={16} strokeWidth={2.5} />
                  Tree-Sitter 2.0 WebAssembly Code-Map
                </div>
                <ul className="changelog-list">
                  <li>
                    Compiled 40+ language grammars to WebAssembly (TypeScript, JavaScript, Python, Rust, Go, C++, Java, Kotlin, Swift, HTML/CSS).
                  </li>
                  <li>
                    Constructs in-memory symbol graphs linking class definitions, function signatures, exported types, and cross-file import statements in under 18ms.
                  </li>
                  <li>
                    Reduces LLM prompt token consumption by up to 80% by providing precision AST context rather than sending entire uncompressed files.
                  </li>
                </ul>
              </div>

              {/* OpenTUI React 19 */}
              <div className="changelog-group">
                <div className="changelog-group-header green">
                  <Terminal size={16} strokeWidth={2.5} />
                  OpenTUI + React 19 Terminal Interface
                </div>
                <ul className="changelog-list">
                  <li>
                    Re-engineered CLI rendering pipeline using OpenTUI and Yoga layout engine for smooth 60FPS fluid streaming.
                  </li>
                  <li>
                    Real-time Markdown syntax highlighting with full 24-bit TrueColor ANSI support across all modern terminal emulators.
                  </li>
                  <li>
                    Interactive keyboard navigation for <code>/model</code> provider switching, file attachment, and session management.
                  </li>
                </ul>
              </div>

              {/* Cross-Platform Standalone */}
              <div className="changelog-group">
                <div className="changelog-group-header orange">
                  <Zap size={16} strokeWidth={2.5} />
                  Cross-Platform Support (macOS, Windows, Linux, Android, iOS)
                </div>
                <ul className="changelog-list">
                  <li>
                    <strong>Android Termux:</strong> Full support for running RivoCode natively on mobile smartphones and tablets via Termux ARM64.
                  </li>
                  <li>
                    <strong>iOS / iPadOS:</strong> Streamlined mobile terminal workflow for iSH Shell, Blink Shell, and remote dev containers.
                  </li>
                  <li>
                    <strong>Windows:</strong> Native PowerShell 7, Command Prompt, and WSL 2 path resolution and TrueColor ANSI compatibility.
                  </li>
                  <li>
                    <strong>macOS &amp; Linux:</strong> Native standalone binaries compiled with Bun <code>--compile</code> for near-zero startup delay.
                  </li>
                </ul>
              </div>

              {/* Technical Dependencies */}
              <div className="changelog-group">
                <div className="changelog-group-header blue">
                  <FileCode2 size={16} strokeWidth={2.5} />
                  Core Architecture Dependencies
                </div>
                <div className="changelog-deps-grid">
                  {techUpdates.map((t) => (
                    <div className="changelog-dep-row" key={t.label}>
                      <code className="changelog-dep-name">{t.label}</code>
                      <span className="changelog-dep-version">{t.version}</span>
                      <span className="changelog-dep-desc">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Binary Packages */}
              <div className="changelog-group">
                <div className="changelog-group-header purple">
                  <Boxes size={16} strokeWidth={2.5} />
                  Compiled Standalone Binaries
                </div>
                <div className="changelog-assets-list">
                  {binaryPackages.map((b) => (
                    <div className="changelog-asset-row" key={b.name}>
                      <div className="changelog-asset-name">
                        <code>{b.name}</code>
                      </div>
                      <div className="changelog-asset-meta">
                        <span className="changelog-asset-type">{b.arch}</span>
                        <span className="changelog-asset-size">{b.size}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GitHub Link */}
              <div className="changelog-footer-link">
                <a
                  href="https://github.com/sanketpadhyal/RivoCode-Cli/releases/tag/v3.0.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="changelog-github-link"
                >
                  <GitMerge size={14} strokeWidth={2.5} />
                  View complete release notes &amp; commits on GitHub
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="changelog-cta">
          <a
            href="https://www.npmjs.com/package/@rivocode-cli/cli"
            target="_blank"
            rel="noopener noreferrer"
            className="changelog-download-btn"
          >
            <Download size={18} strokeWidth={2.5} />
            <span>Install RivoCode v3.0.0 via npm</span>
          </a>
          <a
            href="https://github.com/sanketpadhyal/RivoCode-Cli"
            className="changelog-release-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Star on GitHub ⭐ →
          </a>
        </div>
      </div>
    </section>
  );
};

export default Changelog;
