'use client';

import { useState } from 'react';
import WizardContainer from '@components/wizard/wizard-container';
import { LandingPage } from '@components/landing/landing-page';
import { LanguageSwitcher } from '@components/language-switcher/language-switcher';

const HomePage = () => {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <main className="main-container relative min-h-screen bg-vattjom-background-100">
        <div className="absolute top-[1.6rem] right-[1.6rem]">
          <LanguageSwitcher />
        </div>
        <LandingPage onStart={() => setStarted(true)} />
      </main>
    );
  }

  return (
    <main className="main-container">
      <WizardContainer onBack={() => setStarted(false)} />
    </main>
  );
};

export default HomePage;
