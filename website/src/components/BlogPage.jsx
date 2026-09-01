import React from 'react';
import {
  Code2,
  Cpu,
  Layers,
  Terminal,
} from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import { AppleIcon, AndroidIcon } from './PlatformIcons';

const architectureFacts = [
  {
    icon: Code2,
    color: '#34C759',
    label: 'Tree-Sitter WASM AST',
    value: 'Compiles 40+ language grammars to WebAssembly for instant sub-18ms AST symbol mapping.',
  },
  {
    icon: Layers,
    color: '#AF52DE',
    label: 'Autonomous Subagents',
    value: 'Spawns autonomous worker agents to perform parallel codebase research, diffing, and linting.',
  },
  {
    icon: Terminal,
    color: '#0A84FF',
    label: 'OpenTUI + React 19',
    value: 'Hardware-accelerated terminal UI delivering fluid 60FPS streaming and TrueColor ANSI markdown.',
  },
  {
    icon: Cpu,
    color: '#FF9F0A',
    label: 'Native Multi-LLM Engine',
    value: 'Built-in high-performance adapters for Google Gemini, MiniMax, and Llama foundation models.',
  },
];

const pipelineSteps = [
  {
    number: '01',
    title: 'CLI Bootstrap & Environment Resolution',
    desc: 'When you execute `rivo` or `npx @rivocode-cli/cli`, the launcher resolves your operating system environment, loads active API keys from `.env` or shell variables, and initializes the OpenTUI terminal frame.',
  },
  {
    number: '02',
    title: 'WebAssembly Tree-Sitter AST Indexing',
    desc: 'The code-map engine scans your project root using WebAssembly Tree-Sitter grammars. In under 18ms, it builds an in-memory symbol graph connecting exported classes, methods, type interfaces, and cross-file import paths.',
  },
  {
    number: '03',
    title: 'Context Assembly & Token Compaction',
    desc: 'Before sending requests to the LLM, the Token Compactor filters irrelevant files, compresses past conversation turns, and injects only the precise AST context required for your goal, preventing token bloat.',
  },
  {
    number: '04',
    title: 'Autonomous Multi-Subagent Decomposition',
    desc: 'For complex tasks, RivoCode decomposes the prompt into subgoals. It dynamically spawns specialized subagents (e.g., Code Researcher, AST Auditor, Test Runner) to execute parallel research without context collision.',
  },
  {
    number: '05',
    title: 'Real-Time OpenTUI Token Streaming',
    desc: 'Responses stream back via the multi-provider LLM adapter into React 19 terminal reconcilers. Yoga Layout calculates flexbox coordinates for ANSI escape sequences, rendering flicker-free formatted markdown.',
  },
  {
    number: '06',
    title: 'Tool Invocation & Terminal Execution',
    desc: 'The agent executes tool calls directly on your system—reading files (`read-files`), performing regex code replacements (`propose-str-replace`), writing new modules (`write-file`), and running terminal commands (`run-terminal-command`).',
  },
  {
    number: '07',
    title: 'Unified Multi-File Diff Preview',
    desc: 'All proposed edits are validated against the AST syntax tree and displayed as unified syntax-highlighted diffs with exact line numbers before being applied atomically to disk with rollback protection.',
  },
  {
    number: '08',
    title: 'Self-Healing Test & Verification Loop',
    desc: 'RivoCode automatically runs your project’s build and test suites (`npm test`, `bun test`, `cargo check`). If a syntax error or test failure occurs, the agent intercepts the traceback and self-corrects the code until it passes.',
  },
];

const mobilePlatforms = [
  {
    name: 'Android (Termux Setup)',
    Icon: AndroidIcon,
    color: '#34C759',
    steps: [
      'Install Termux from F-Droid on your Android smartphone or tablet.',
      'Run: pkg update && pkg install nodejs-lts git',
      'Install globally: npm install -g @rivocode-cli/cli',
      'Grant storage access: termux-setup-storage',
      'Launch: rivo',
    ],
  },
  {
    name: 'iOS / iPadOS (iSH & SSH)',
    Icon: AppleIcon,
    color: '#AF52DE',
    steps: [
      'Install iSH Shell or Blink Shell from the iOS App Store.',
      'In iSH: apk add nodejs npm git && npm i -g @rivocode-cli/cli',
      'Or in Blink: SSH directly into your remote dev machine or cloud container.',
      'Attach Magic Keyboard or Bluetooth keyboard for optimal coding experience.',
      'Launch: rivo',
    ],
  },
];

const BlogPage = () => {
  return (
    <div className="app-landing blog-page">
      <Navbar />

      <main style={{ paddingTop: '90px' }}>
        {/* 4 Architecture Facts */}
        <section className="docs-facts-section">
          <div className="section-container">
            <div className="section-header">
              <h1 className="section-title">Documentation</h1>
              <p className="section-subtitle">
                Technical architecture, execution pipeline, and mobile terminal setup guides.
              </p>
            </div>

            <div className="docs-facts-grid">
              {architectureFacts.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div className="docs-fact-card" key={idx}>
                    <div
                      className="docs-fact-icon"
                      style={{
                        backgroundColor: `${item.color}15`,
                        color: item.color,
                      }}
                    >
                      <Icon size={20} />
                    </div>
                    <h3 className="docs-fact-title">{item.label}</h3>
                    <p className="docs-fact-desc">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 8-Step Execution Pipeline */}
        <section className="docs-pipeline-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">Execution Pipeline</h2>
              <p className="section-subtitle">
                How RivoCode processes coding instructions from prompt to verification.
              </p>
            </div>

            <div className="docs-pipeline-list">
              {pipelineSteps.map((step) => (
                <div className="docs-pipeline-card" key={step.number}>
                  <div className="pipeline-num">{step.number}</div>
                  <div className="pipeline-info">
                    <h3 className="pipeline-title">{step.title}</h3>
                    <p className="pipeline-desc">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mobile Terminal Workflow */}
        <section className="docs-mobile-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">Mobile Terminal Guides</h2>
              <p className="section-subtitle">
                Run RivoCode on Android via Termux or iOS via iSH and SSH containers.
              </p>
            </div>

            <div className="docs-mobile-grid">
              {mobilePlatforms.map((plat) => {
                const PlatIcon = plat.Icon;
                return (
                  <div key={plat.name} className="docs-mobile-card">
                    <div className="docs-mobile-header">
                      <div
                        className="docs-mobile-icon"
                        style={{
                          backgroundColor: `${plat.color}15`,
                          color: plat.color,
                        }}
                      >
                        <PlatIcon size={22} />
                      </div>
                      <h3 className="docs-mobile-title">{plat.name}</h3>
                    </div>
                    <div className="docs-mobile-steps">
                      {plat.steps.map((st, sIdx) => (
                        <div key={sIdx} className="docs-mobile-step-row">
                          <span className="docs-step-idx">{sIdx + 1}</span>
                          <span className="docs-step-text">{st}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default BlogPage;
