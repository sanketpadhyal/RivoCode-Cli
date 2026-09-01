import React from 'react';
import { Smartphone, DownloadCloud, CheckCircle } from 'lucide-react';

const Usage = () => {
  const steps = [
    {
      Icon: DownloadCloud,
      step: '01',
      title: 'Get the APK',
      desc: 'Download the compiled APK directly from the GitHub releases page to your Android phone.'
    },
    {
      Icon: Smartphone,
      step: '02',
      title: 'Select Engine',
      desc: 'Open Rivo Agent and choose a supported GGUF model. The app detects your hardware RAM and storage automatically.'
    },
    {
      Icon: CheckCircle,
      step: '03',
      title: 'Chat Offline',
      desc: 'Once the model installation completes, turn off your data or WiFi. Your private chat workspace is fully ready!'
    }
  ];

  return (
    <section id="usage" className="usage-section">
      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title">Zero-Configuration Setup</h2>
          <p className="section-subtitle">
            Get your private mobile intelligence up and running in three effortless steps.
          </p>
        </div>
        <div className="steps-container">
          {steps.map((item, idx) => {
            const Icon = item.Icon;
            return (
              <div key={idx} className="step-card">
                <div className="step-badge">{item.step}</div>
                <div className="step-icon-wrapper">
                  <Icon size={28} className="step-icon" />
                </div>
                <h3 className="step-title">{item.title}</h3>
                <p className="step-desc">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Usage;
