import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { AppleIcon, WindowsIcon, LinuxIcon, AndroidIcon } from './PlatformIcons';

const platformsData = [
  {
    id: 'mac',
    name: 'macOS',
    title: 'macOS Installation',
    Icon: AppleIcon,
    subtitle: 'Apple Silicon (M1/M2/M3/M4) & Intel support with native terminal performance.',
    requirements: ['macOS 12.0 or newer', 'Node.js >= 20.0 or Bun runtime'],
    tabs: [
      { label: 'Homebrew', cmd: 'brew install sanketpadhyal/tap/rivocode' },
      { label: 'npm', cmd: 'npm install -g @rivocode-cli/cli' },
      { label: 'bun', cmd: 'bun add -g @rivocode-cli/cli' },
      { label: 'pnpm', cmd: 'pnpm add -g @rivocode-cli/cli' },
      { label: 'Instant Run', cmd: 'npx @rivocode-cli/cli' },
    ],
    verifyCmd: 'rivo --version',
  },
  {
    id: 'windows',
    name: 'Windows',
    title: 'Windows Installation',
    Icon: WindowsIcon,
    subtitle: 'Native PowerShell, Command Prompt, Windows Terminal, and WSL 2 support.',
    requirements: ['Windows 10 / 11', 'Node.js >= 20.0 or WSL 2'],
    tabs: [
      { label: 'npm', cmd: 'npm install -g @rivocode-cli/cli' },
      { label: 'pnpm', cmd: 'pnpm add -g @rivocode-cli/cli' },
      { label: 'yarn', cmd: 'yarn global add @rivocode-cli/cli' },
      { label: 'WSL 2', cmd: 'sudo npm install -g @rivocode-cli/cli' },
      { label: 'Instant Run', cmd: 'npx @rivocode-cli/cli' },
    ],
    verifyCmd: 'rivo --version',
  },
  {
    id: 'linux',
    name: 'Linux',
    title: 'Linux Installation',
    Icon: LinuxIcon,
    subtitle: 'Ubuntu, Debian, Arch Linux, Fedora, Alpine, Docker & CI/CD servers.',
    requirements: ['Linux with glibc or musl', 'Node.js >= 20.0 or Bun'],
    tabs: [
      { label: 'npm', cmd: 'sudo npm install -g @rivocode-cli/cli' },
      { label: 'bun', cmd: 'bun add -g @rivocode-cli/cli' },
      { label: 'pnpm', cmd: 'pnpm add -g @rivocode-cli/cli' },
      { label: 'Instant Run', cmd: 'npx @rivocode-cli/cli' },
    ],
    verifyCmd: 'rivo --version',
  },
  {
    id: 'android',
    name: 'Android (Termux)',
    title: 'Android Termux Setup',
    Icon: AndroidIcon,
    subtitle: 'Run full AI coding directly on your smartphone or tablet in Termux.',
    requirements: ['Termux installed from F-Droid', 'Storage permissions via termux-setup-storage'],
    tabs: [
      { label: '1. Termux Setup', cmd: 'pkg update && pkg install nodejs-lts git' },
      { label: '2. Install CLI', cmd: 'npm install -g @rivocode-cli/cli' },
      { label: '3. Launch', cmd: 'rivo' },
      { label: 'Instant Run', cmd: 'npx @rivocode-cli/cli' },
    ],
    verifyCmd: 'rivo --version',
  },
  {
    id: 'ios',
    name: 'iOS / iPadOS',
    title: 'iOS & iPadOS Setup',
    Icon: AppleIcon,
    subtitle: 'Pair your iPad Pro or iPhone with iSH Shell or remote SSH containers.',
    requirements: ['iSH Shell or Blink Shell from App Store', 'External keyboard recommended for iPad'],
    tabs: [
      { label: 'iSH (Alpine)', cmd: 'apk add nodejs npm git && npm i -g @rivocode-cli/cli' },
      { label: 'Remote SSH', cmd: 'ssh user@host -t "rivo"' },
      { label: 'Instant Run', cmd: 'npx @rivocode-cli/cli' },
    ],
    verifyCmd: 'rivo --version',
  },
];

const Platforms = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('mac');
  const [copiedTab, setCopiedTab] = useState(null);

  const current = platformsData.find((p) => p.id === selectedPlatform) || platformsData[0];
  const IconComponent = current.Icon;

  const handleCopy = (cmd, tabName) => {
    navigator.clipboard.writeText(cmd);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <section id="platforms" className="platforms-section">
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title">Supported Platforms</h2>
          <p className="section-subtitle">
            Install and run RivoCode across your operating system with simple commands.
          </p>
        </div>

        {/* Platform Selector Grid */}
        <div className="platform-tabs-grid">
          {platformsData.map((plat) => {
            const PlatIcon = plat.Icon;
            const isSelected = selectedPlatform === plat.id;
            return (
              <button
                key={plat.id}
                onClick={() => setSelectedPlatform(plat.id)}
                className={`platform-select-card ${isSelected ? 'active' : ''}`}
              >
                <div className="platform-select-icon">
                  <PlatIcon size={22} />
                </div>
                <span className="platform-select-name">{plat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Platform Detail Box */}
        <div className="platform-detail-box">
          <div className="platform-detail-header">
            <div className="detail-title-group">
              <div className="detail-icon-circle">
                <IconComponent size={26} />
              </div>
              <div>
                <h3 className="detail-main-title">{current.title}</h3>
                <p className="detail-subtitle">{current.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="platform-cmd-tabs">
            {current.tabs.map((tab, idx) => {
              const isCopied = copiedTab === `${current.id}-${idx}`;
              return (
                <div key={idx} className="platform-cmd-row">
                  <span className="cmd-label-badge">{tab.label}</span>
                  <code className="cmd-code-text">{tab.cmd}</code>
                  <button
                    onClick={() => handleCopy(tab.cmd, `${current.id}-${idx}`)}
                    className={`cmd-copy-action-btn ${isCopied ? 'copied' : ''}`}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} className="text-emerald" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="platform-verify-box">
            <span className="verify-label">Verify:</span>
            <code className="verify-cmd">{current.verifyCmd}</code>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Platforms;
