import React, { useState } from 'react';
import { Menu, X, ExternalLink } from 'lucide-react';
import { GithubIcon } from './PlatformIcons';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <nav className="navbar">
      <div className="nav-container">
        {/* Clean Logo */}
        <div
          className="nav-logo"
          onClick={() => {
            if (isDocs) {
              window.location.href = '/';
              return;
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <img src="/logo.png" alt="RivoCode Logo" className="logo-img" />
          <span className="logo-text">RivoCode</span>
        </div>

        {/* Clean Nav Links */}
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
          >
            <GithubIcon size={16} />
            <span>GitHub</span>
          </a>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          <div className="mobile-nav-inner">
            <button onClick={() => scrollToSection('platforms')} className="mobile-nav-item">
              Platforms
            </button>
            <button onClick={() => scrollToSection('features')} className="mobile-nav-item">
              Features
            </button>
            <button onClick={() => scrollToSection('models')} className="mobile-nav-item">
              Providers
            </button>
            <a href="/blog" className="mobile-nav-item">
              Documentation
            </a>
            <div className="mobile-drawer-footer">
              <a
                href="https://github.com/sanketpadhyal/RivoCode-Cli"
                target="_blank"
                rel="noopener noreferrer"
                className="mobile-gh-btn"
              >
                <GithubIcon size={16} />
                <span>GitHub Repository</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
