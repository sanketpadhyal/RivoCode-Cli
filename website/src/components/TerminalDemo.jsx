import React, { useState, useEffect } from 'react';
import {
  Terminal,
  RotateCcw,
  GitBranch,
  CheckCircle2,
  Cpu,
  Layers,
  FileCode2,
} from 'lucide-react';

const scenarios = [
  {
    id: 'plan',
    title: '1. Planning & Architecture',
    lines: [
      { type: 'input', text: '$ rivo --plan "Migrate auth to JWT tokens with Redis cache"' },
      { type: 'system', text: '✦ Code-Map AST initialized (142 files indexed)' },
      { type: 'agent', text: 'Analyzing dependency tree in /src/auth...' },
      {
        type: 'tool',
        icon: 'ast',
        title: 'Tree-Sitter AST Search',
        detail: 'Resolved: AuthService.ts, auth.middleware.ts, redis.client.ts, user.model.ts',
      },
      {
        type: 'plan-card',
        title: 'Roadmap (5 Steps)',
        steps: [
          '1. Implement TokenService with RS256 signing',
          '2. Add Redis session cache client',
          '3. Update auth.middleware.ts with Bearer validation',
          '4. Create atomic database migration scripts',
          '5. Run test suite: bun test src/auth/**/*.test.ts',
        ],
      },
      { type: 'success', text: '✔ Plan approved. Applying atomic edits...' },
    ],
  },
  {
    id: 'swarm',
    title: '2. Multi-Subagent Swarm',
    lines: [
      { type: 'input', text: '$ rivo "Audit security headers and run full test verification"' },
      { type: 'system', text: '✦ Spawning worker subagents (Pool: 3)...' },
      {
        type: 'subagent',
        name: 'Subagent #1: Code Auditor',
        status: 'Scanning middleware stack for CORS, CSP, and HSTS headers...',
        result: 'Found 2 missing security headers in helmet.config.ts',
      },
      {
        type: 'subagent',
        name: 'Subagent #2: Refactorer',
        status: 'Patching server middleware chain with updated policy...',
        result: 'Updated server.ts and security.test.ts',
      },
      {
        type: 'subagent',
        name: 'Subagent #3: Test Runner',
        status: 'Running: npm test -- --coverage',
        result: 'PASS: 38/38 unit tests (100% coverage)',
      },
      { type: 'success', text: '✔ All subagents completed. Workspace validated.' },
    ],
  },
  {
    id: 'diff',
    title: '3. Multi-File Diffs',
    lines: [
      { type: 'input', text: '$ rivo "Add OAuth2 Google Provider with refresh token rotation"' },
      { type: 'system', text: '✦ Generating unified diffs across 2 files...' },
      {
        type: 'diff-card',
        file: 'src/services/oauth.service.ts',
        diffs: [
          { type: 'add', line: '+ export class GoogleOAuthProvider implements OAuthProvider {' },
          { type: 'add', line: '+   async exchangeCodeForTokens(code: string): Promise<Tokens> {' },
          { type: 'add', line: '+     const { tokens } = await this.client.getToken(code);' },
          { type: 'add', line: '+     return this.storeSession(tokens.id_token, tokens.refresh_token);' },
          { type: 'add', line: '+   }' },
          { type: 'del', line: '-   // TODO: Add Google OAuth integration here' },
        ],
      },
      {
        type: 'diff-card',
        file: 'src/routes/auth.routes.ts',
        diffs: [
          { type: 'add', line: '+ router.get("/auth/google/callback", authController.googleCallback);' },
        ],
      },
      { type: 'tool', icon: 'term', title: 'Shell Execution', detail: '$ tsc --noEmit && bun test' },
      { type: 'success', text: '✔ Types checked clean. 0 errors found.' },
    ],
  },
  {
    id: 'chat',
    title: '4. Interactive Chat & /model',
    lines: [
      { type: 'input', text: '$ rivo' },
      { type: 'system', text: '✦ Welcome to RivoCode • Type /help for commands' },
      { type: 'user-chat', prompt: 'rivo> /model' },
      {
        type: 'model-menu',
        title: 'Select Active LLM Provider:',
        models: [
          { name: 'Google Gemini 2.5 Pro', active: true },
          { name: 'Anthropic Claude 3.7 Sonnet', active: false },
          { name: 'OpenAI GPT-4.5 / o3-mini', active: false },
          { name: 'DeepSeek R1', active: false },
        ],
      },
      { type: 'user-chat', prompt: 'rivo> How does Tree-Sitter AST resolution work in RivoCode?' },
      {
        type: 'stream-agent',
        text: 'RivoCode compiles tree-sitter grammars into WebAssembly binaries. On startup, it parses files into an in-memory symbol graph that accurately links classes, functions, and imports for fast, token-efficient context.',
      },
    ],
  },
];

const TerminalDemo = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [visibleCount, setVisibleCount] = useState(1);

  const currentScenario = scenarios[activeTab];

  useEffect(() => {
    setVisibleCount(1);
    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev < currentScenario.lines.length) {
          return prev + 1;
        }
        return prev;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [activeTab, currentScenario.lines.length]);

  const handleRestart = () => {
    setVisibleCount(1);
  };

  return (
    <section id="demo" className="terminal-demo-section">
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title">Terminal Demo</h2>
          <p className="section-subtitle">
            See RivoCode plan, spawn subagents, and edit multi-file codebases in real time.
          </p>
        </div>

        <div className="demo-tabs-bar">
          {scenarios.map((sc, idx) => (
            <button
              key={sc.id}
              onClick={() => setActiveTab(idx)}
              className={`demo-tab-btn ${activeTab === idx ? 'active' : ''}`}
            >
              <Terminal size={14} />
              <span>{sc.title}</span>
            </button>
          ))}
        </div>

        <div className="terminal-window-wrapper">
          <div className="terminal-window">
            <div className="terminal-topbar">
              <div className="terminal-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <div className="terminal-title">
                <Terminal size={13} />
                <span>rivo — terminal</span>
              </div>
              <div className="terminal-badges">
                <span className="terminal-git-badge">
                  <GitBranch size={11} />
                  <span>main</span>
                </span>
              </div>
            </div>

            <div className="terminal-body">
              {currentScenario.lines.slice(0, visibleCount).map((line, idx) => {
                if (line.type === 'input') {
                  return (
                    <div key={idx} className="terminal-line input-line">
                      <span className="prompt-arrow">➜</span>
                      <span className="prompt-dir">~/project</span>
                      <span className="prompt-cmd">{line.text}</span>
                    </div>
                  );
                }

                if (line.type === 'system') {
                  return (
                    <div key={idx} className="terminal-line system-line">
                      <span className="system-tag">{line.text}</span>
                    </div>
                  );
                }

                if (line.type === 'agent') {
                  return (
                    <div key={idx} className="terminal-line agent-line">
                      <span className="agent-tag">rivo:</span>
                      <span className="agent-text">{line.text}</span>
                    </div>
                  );
                }

                if (line.type === 'tool') {
                  return (
                    <div key={idx} className="terminal-line tool-line">
                      <div className="tool-badge">
                        <Cpu size={13} />
                        <span>[tool: {line.title}]</span>
                      </div>
                      <span className="tool-detail">{line.detail}</span>
                    </div>
                  );
                }

                if (line.type === 'plan-card') {
                  return (
                    <div key={idx} className="terminal-plan-card">
                      <div className="plan-card-header">
                        <Layers size={14} className="text-blue" />
                        <span>{line.title}</span>
                      </div>
                      <div className="plan-steps">
                        {line.steps.map((step, sIdx) => (
                          <div key={sIdx} className="plan-step-item">
                            <span className="step-arrow">→</span>
                            <code>{step}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (line.type === 'subagent') {
                  return (
                    <div key={idx} className="terminal-subagent-card">
                      <div className="subagent-header">
                        <span className="subagent-pulse" />
                        <strong>{line.name}</strong>
                      </div>
                      <div className="subagent-status">{line.status}</div>
                      <div className="subagent-result">
                        <CheckCircle2 size={13} className="text-emerald" />
                        <span>{line.result}</span>
                      </div>
                    </div>
                  );
                }

                if (line.type === 'diff-card') {
                  return (
                    <div key={idx} className="terminal-diff-card">
                      <div className="diff-header">
                        <FileCode2 size={13} />
                        <span>{line.file}</span>
                      </div>
                      <div className="diff-lines">
                        {line.diffs.map((d, dIdx) => (
                          <div
                            key={dIdx}
                            className={`diff-line ${d.type === 'add' ? 'diff-add' : 'diff-del'}`}
                          >
                            <code>{d.line}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (line.type === 'user-chat') {
                  return (
                    <div key={idx} className="terminal-line user-chat-line">
                      <span className="chat-user-prompt">{line.prompt}</span>
                    </div>
                  );
                }

                if (line.type === 'model-menu') {
                  return (
                    <div key={idx} className="terminal-model-menu">
                      <div className="model-menu-title">{line.title}</div>
                      {line.models.map((m, mIdx) => (
                        <div
                          key={mIdx}
                          className={`model-option ${m.active ? 'active-model' : ''}`}
                        >
                          <span className="model-bullet">{m.active ? '●' : '○'}</span>
                          <span>{m.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                }

                if (line.type === 'stream-agent') {
                  return (
                    <div key={idx} className="terminal-stream-box">
                      <span className="stream-author">RivoCode Agent:</span>
                      <p className="stream-text">{line.text}</p>
                    </div>
                  );
                }

                if (line.type === 'success') {
                  return (
                    <div key={idx} className="terminal-line success-line">
                      <span className="text-emerald">{line.text}</span>
                    </div>
                  );
                }

                return null;
              })}

              <div className="terminal-cursor-row">
                <span className="terminal-cursor" />
              </div>
            </div>

            <div className="terminal-controls-footer">
              <div className="footer-status">
                <span className="status-live-dot" />
                <span>Ready for input</span>
              </div>
              <button onClick={handleRestart} className="terminal-restart-btn">
                <RotateCcw size={13} />
                <span>Replay</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TerminalDemo;
