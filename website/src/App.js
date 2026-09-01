import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Platforms from './components/Platforms';
import Features from './components/Features';
import Models from './components/Models';
import Footer from './components/Footer';
import BlogPage from './components/BlogPage';
import './App.css';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentPath === '/blog' || currentPath === '/docs') {
    return <BlogPage />;
  }

  return (
    <div className="app-landing">
      <Navbar />
      <main>
        <Hero />
        <Platforms />
        <Features />
        <Models />
      </main>
      <Footer />
    </div>
  );
}

export default App;
