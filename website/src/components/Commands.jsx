import React, { useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Slash,
} from 'lucide-react';

const cliFlags = [
  {
    flag: '--plan',
    title: 'Plan Mode',
    desc: 'Generates detailed architectural roadmaps and dependency DAGs before modifying any files.',
    example: 'rivo --plan "Refactor user authentication service"',
  },
  {
    flag: '--lite',
    title: 'Lite Mode',
    desc: 'High-speed execution optimized for quick fixes, single-file edits, and low token latency.',
    example: 'rivo --lite "Fix syntax error in router.ts:15"',
  },
  {
    flag: '--max',
    title: 'Max Reasoning Mode',
    desc: 'Extended chain-of-thought depth with autonomous subagent swarm execution and deep test loops.',
    example: 'rivo --max "Implement distributed raft consensus algorithm"',
  },
  {
    flag: '--continue [id]',
    title: 'Continue Session',
    desc: 'Resumes an existing conversation session with full memory recall and previous file edits.',
    example: 'rivo --continue 53cc312e',
  },
  {
    flag: '--cwd <path>',
    title: 'Custom Working Dir',
    desc: 'Sets the project root directory explicitly when running from outside the repository.',
    example: 'rivo --cwd /var/www/my-project',
  },
  {
    flag: '--clear-logs',
    title: 'Clear Session Logs',
    desc: 'Cleans previous execution logs, telemetry artifacts, and temporary scratch cache.',
    example: 'rivo --clear-logs',
  },
  {
    flag: '--agent <id>',
    title: 'Custom Agent ID',
    desc: 'Runs a specific custom agent definition, skipping local workspace agent overrides.',
    example: 'rivo --agent security-auditor',
  },
  {
    flag: '-v, --version',
    title: 'Version Check',
    desc: 'Outputs the installed version of RivoCode CLI and its WebAssembly Tree-Sitter grammar build.',
    example: 'rivo --version',
  },
];

const slashCommands = [
  {
    cmd: '/model',
    badge: 'LLM Switcher',
    badgeColor: '#34C759',
    desc: 'Opens the interactive arrow-key model switcher dialog (Gemini 2.5, Claude 3.7, GPT-4.5, DeepSeek R1).',
  },
  {
    cmd: '/attach <file>',
    badge: 'Context Injection',
    badgeColor: '#0A84FF',
    desc: 'Injects specific file content or AST subtrees directly into the active prompt context window.',
  },
  {
    cmd: '/clear',
    badge: 'Reset Memory',
    badgeColor: '#AF52DE',
    desc: 'Clears the active conversation context and frees working memory while keeping the indexed AST intact.',
  },
  {
    cmd: '/help',
    badge: 'Command Menu',
    badgeColor: '#FF9F0A',
    desc: 'Displays the complete interactive command reference, keyboard shortcuts, and active model status.',
  },
  {
    cmd: '/publish',
    badge: 'Agent Registry',
    badgeColor: '#34C759',
    desc: 'Publishes local custom agent definitions and workspace skills to the public/team registry.',
  },
  {
    cmd: '/login',
    badge: 'Authentication',
    badgeColor: '#0A84FF',
    desc: 'Logs into your account to synchronize workspace preferences and API credentials securely.',
  },
];

const Commands = () => {
  const [copiedCmd, setCopiedCmd] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <section id="commands" className="commands-section">
      <div className="section-container">
        {/* Header */}
        <div className="section-header">
          <div className="section-eyebrow">
            <Terminal size={14} className="text-emerald" />
            <span>CLI Reference &amp; Shortcuts</span>
          </div>
          <h2 className="section-title">Command &amp; Slash Command Cheatsheet</h2>
          <p className="section-subtitle">
            Complete command-line arguments, execution flags, and in-terminal slash commands to
            streamline your development workflow.
          </p>
        </div>

        {/* CLI Flags Grid */}
        <div className="commands-block-title">
          <Terminal size={18} className="text-blue" />
          <span>Command Line Arguments &amp; Flags</span>
        </div>

        <div className="flags-grid">
          {cliFlags.map((flag, idx) => {
            const isCopied = copiedCmd === `flag-${idx}`;
            return (
              <div key={idx} className="flag-card">
                <div className="flag-card-header">
                  <span className="flag-code">
                    <code>{flag.flag}</code>
                  </span>
                  <span className="flag-title">{flag.title}</span>
                </div>
                <p className="flag-desc">{flag.desc}</p>
                <div className="flag-example-row">
                  <span className="example-tag">e.g.</span>
                  <code className="example-code">{flag.example}</code>
                  <button
                    onClick={() => handleCopy(flag.example, `flag-${idx}`)}
                    className={`flag-copy-btn ${isCopied ? 'copied' : ''}`}
                    title="Copy example"
                  >
                    {isCopied ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive Slash Commands Grid */}
        <div className="commands-block-title slash-title-margin">
          <Slash size={18} className="text-purple" />
          <span>Interactive In-Terminal Slash Commands</span>
        </div>

        <div className="slash-grid">
          {slashCommands.map((slash, idx) => {
            const isCopied = copiedCmd === `slash-${idx}`;
            return (
              <div key={idx} className="slash-card">
                <div className="slash-card-header">
                  <div className="slash-cmd-box">
                    <code>{slash.cmd}</code>
                  </div>
                  <span
                    className="slash-badge"
                    style={{
                      backgroundColor: `${slash.badgeColor}15`,
                      color: slash.badgeColor,
                      borderColor: `${slash.badgeColor}35`,
                    }}
                  >
                    {slash.badge}
                  </span>
                </div>
                <p className="slash-desc">{slash.desc}</p>
                <button
                  onClick={() => handleCopy(slash.cmd, `slash-${idx}`)}
                  className="slash-copy-action"
                >
                  {isCopied ? (
                    <>
                      <Check size={13} className="text-emerald" />
                      <span>Copied: {slash.cmd}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Command</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Commands;
