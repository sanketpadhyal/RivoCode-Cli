import React from 'react';

const llmData = [
  {
    name: 'Google Gemini',
    models: 'Gemini 2.5 Flash / Pro',
    logo: '/models/gemini.png',
  },
  {
    name: 'MiniMax',
    models: 'MiniMax 01',
    logo: '/models/minimax.png',
  },
  {
    name: 'Llama',
    models: 'Llama 3.3 / Llama 3.2',
    logo: '/models/llama.png',
  },
];

const Models = () => {
  return (
    <section id="models" className="models-section">
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title">Supported LLMs</h2>
          <p className="section-subtitle">
            Powered by industry-leading foundation models.
          </p>
        </div>

        <div className="llm-grid">
          {llmData.map((llm, idx) => (
            <div key={idx} className="llm-card">
              <div className="llm-logo-box">
                <img src={llm.logo} alt={`${llm.name} logo`} className="llm-logo-img" />
              </div>
              <div className="llm-info">
                <h3 className="llm-name">{llm.name}</h3>
                <p className="llm-models">{llm.models}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Models;
