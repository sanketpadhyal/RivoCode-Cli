import React from 'react';
import { Globe, Mail, Boxes } from 'lucide-react';
import { GithubIcon } from './PlatformIcons';

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id) => {
    if (window.location.pathname === '/blog' || window.location.pathname === '/docs') {
      window.location.href = `/#${id}`;
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="footer-section">
      <div className="footer-container">
        {/* Brand Column */}
        <div className="footer-brand">
          <div className="footer-logo-row" onClick={scrollToTop}>
            <img src="/logo.png" alt="RivoCode Logo" className="footer-logo-img" />
            <span className="footer-logo-text">RivoCode</span>
          </div>

          <p className="brand-disclaimer">
            A terminal-native AI coding assistant built for speed, full codebase AST awareness,
            and multi-file workflows.
          </p>
        </div>

        {/* Links */}
        <div className="footer-nav-col">
          <span className="footer-header">Navigation</span>
          <div className="footer-links-list">
            <button onClick={() => scrollToSection('platforms')} className="footer-link-btn">
              Platforms
            </button>
            <button onClick={() => scrollToSection('features')} className="footer-link-btn">
              Features
            </button>
            <button onClick={() => scrollToSection('models')} className="footer-link-btn">
              Providers
            </button>
            <a href="/blog" className="footer-link-btn">
              Documentation
            </a>
          </div>
        </div>

        {/* Developer Column */}
        <div className="footer-developer">
          <span className="footer-header">Developer</span>
          <div className="dev-details">
            <a
              href="https://github.com/sanketpadhyal/RivoCode-Cli"
              className="dev-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GithubIcon size={14} />
              <span>GitHub</span>
            </a>
            <a
              href="https://www.npmjs.com/package/@rivocode-cli/cli"
              className="dev-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Boxes size={14} />
              <span>npm Package</span>
            </a>
            <a
              href="https://www.sanketpadhyal.in"
              className="dev-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Globe size={14} />
              <span>sanketpadhyal.in</span>
            </a>
            <a href="mailto:sanketpadhyal3@gmail.com" className="dev-link">
              <Mail size={14} />
              <span>Email</span>
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <p className="copyright-text">
            &copy; {new Date().getFullYear()} Sanket Padhyal. MIT License.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
