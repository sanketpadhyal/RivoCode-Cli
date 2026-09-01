import React from 'react';
import { AppleIcon, WindowsIcon, LinuxIcon, AndroidIcon } from './PlatformIcons';

const Hero = () => {
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="hero-section">
      <div className="hero-container">
        <div className="hero-info">
          {/* Main Title */}
          <h1 className="hero-title">
            Your Terminal-Native <br />
            <span className="gradient-text">Autonomous AI Engineer</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle">
            Index your entire codebase with Tree-Sitter AST, spawn autonomous subagents, execute
            shell tools, and edit multiple files directly from your terminal.
          </p>

          {/* Platforms Bar */}
          <div className="hero-platforms-bar">
            <div className="platforms-list">
              <button onClick={() => scrollToSection('platforms')} className="platform-chip">
                <AppleIcon size={15} />
                <span>macOS</span>
              </button>
              <button onClick={() => scrollToSection('platforms')} className="platform-chip">
                <WindowsIcon size={14} />
                <span>Windows</span>
              </button>
              <button onClick={() => scrollToSection('platforms')} className="platform-chip">
                <LinuxIcon size={15} />
                <span>Linux</span>
              </button>
              <button onClick={() => scrollToSection('platforms')} className="platform-chip android-highlight">
                <AndroidIcon size={15} />
                <span>Android (Termux)</span>
              </button>
              <button onClick={() => scrollToSection('platforms')} className="platform-chip">
                <AppleIcon size={15} />
                <span>iOS</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Hero;
