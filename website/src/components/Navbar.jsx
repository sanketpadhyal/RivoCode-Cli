import React, { useState, useEffect } from 'react';
import { Menu, X, ExternalLink, Laptop, Sparkles, Cpu, BookOpen, ChevronRight } from 'lucide-react';
import { GithubIcon } from './PlatformIcons';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    if (window.location.pathname === '/blog' || window.location.pathname === '/docs') {
      window.location.href = `/#${id}`;
      return;
    }

    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isDocs = window.location.pathname === '/blog' || window.location.pathname === '/docs';

  return (
    <nav className={`navbar ${mobileMenuOpen ? 'nav-open' : ''}`}>
      <div className="nav-container">
        {/* Clean Logo */}
        <div
          className="nav-logo"
          onClick={() => {
            setMobileMenuOpen(false);
            if (isDocs) {
              window.location.href = '/';
              return;
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          role="button"
          tabIndex={0}
        >
          <img src="/logo.png" alt="RivoCode Logo" className="logo-img" />
          <span className="logo-text">RivoCode</span>
        </div>

        {/* Desktop Nav Links */}
        <div className="nav-links">
          <button onClick={() => scrollToSection('platforms')} className="nav-link-btn">
            Platforms
          </button>
          <button onClick={() => scrollToSection('features')} className="nav-link-btn">
            Features
          </button>
          <button onClick={() => scrollToSection('models')} className="nav-link-btn">
            Providers
          </button>
          <a href="/blog" className={`nav-link-anchor ${isDocs ? 'active' : ''}`}>
            Docs
          </a>
        </div>

        {/* Action Button */}
        <div className="nav-actions">
          <a
            href="https://github.com/sanketpadhyal/RivoCode-Cli"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-github-btn"
            aria-label="GitHub Repository"
          >
            <GithubIcon size={16} />
            <span className="nav-github-text">GitHub</span>
          </a>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Panel */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          <div className="mobile-nav-inner">
            <button
              onClick={() => scrollToSection('platforms')}
              className="mobile-nav-card"
            >
              <div className="mobile-nav-card-left">
                <div className="mobile-nav-icon-box">
                  <Laptop size={18} />
                </div>
                <div className="mobile-nav-card-info">
                  <span className="mobile-nav-card-title">Platforms</span>
                  <span className="mobile-nav-card-desc">macOS, Windows, Linux, Android, iOS</span>
                </div>
              </div>
              <ChevronRight size={18} className="mobile-nav-chevron" />
            </button>

            <button
              onClick={() => scrollToSection('features')}
              className="mobile-nav-card"
            >
              <div className="mobile-nav-card-left">
                <div className="mobile-nav-icon-box">
                  <Sparkles size={18} />
                </div>
                <div className="mobile-nav-card-info">
                  <span className="mobile-nav-card-title">Features</span>
                  <span className="mobile-nav-card-desc">Tree-Sitter AST, Subagents & Shell</span>
                </div>
              </div>
              <ChevronRight size={18} className="mobile-nav-chevron" />
            </button>

            <button
              onClick={() => scrollToSection('models')}
              className="mobile-nav-card"
            >
              <div className="mobile-nav-card-left">
                <div className="mobile-nav-icon-box">
                  <Cpu size={18} />
                </div>
                <div className="mobile-nav-card-info">
                  <span className="mobile-nav-card-title">Providers</span>
                  <span className="mobile-nav-card-desc">Gemini, MiniMax, Llama</span>
                </div>
              </div>
              <ChevronRight size={18} className="mobile-nav-chevron" />
            </button>

            <a
              href="/blog"
              className={`mobile-nav-card ${isDocs ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="mobile-nav-card-left">
                <div className="mobile-nav-icon-box">
                  <BookOpen size={18} />
                </div>
                <div className="mobile-nav-card-info">
                  <span className="mobile-nav-card-title">Documentation</span>
                  <span className="mobile-nav-card-desc">Architecture & Execution Pipeline</span>
                </div>
              </div>
              <ChevronRight size={18} className="mobile-nav-chevron" />
            </a>
          </div>

          <div className="mobile-drawer-footer">
            <a
              href="https://github.com/sanketpadhyal/RivoCode-Cli"
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-gh-btn"
              onClick={() => setMobileMenuOpen(false)}
            >
              <GithubIcon size={18} />
              <span>GitHub Repository</span>
              <ExternalLink size={15} />
            </a>
            <div className="mobile-drawer-credits">
              <span>RivoCode CLI • Sanket Padhyal</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
