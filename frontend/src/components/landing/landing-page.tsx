'use client';

import { Button } from '@sk-web-gui/react';
import { Logo } from '@sk-web-gui/logo';
import LucideIcon from '@sk-web-gui/lucide-icon';
import { useTranslation } from 'react-i18next';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage = ({ onStart }: LandingPageProps) => {
  const { t } = useTranslation('landing');

  return (
    <div className="flex flex-col items-center justify-center gap-32 py-48 px-16 text-center min-h-[70vh]">
      <Logo variant="symbol" className="w-80 h-80" />

      <div className="flex flex-col gap-12 max-w-md">
        <h1 className="text-h2-sm md:text-h2-md">{t('title')}</h1>
        <p className="text-large text-dark-secondary">{t('description')}</p>
      </div>

      <div className="flex flex-col gap-12 max-w-sm w-full">
        <Button
          variant="primary"
          size="lg"
          onClick={onStart}
          rightIcon={<LucideIcon name="arrow-right" />}
          className="w-full"
        >
          {t('start_button')}
        </Button>
      </div>

      <ul className="flex flex-col gap-8 text-small text-dark-secondary text-left max-w-sm">
        <li className="flex gap-8 items-start">
          <LucideIcon name="camera" size={16} className="mt-2 shrink-0" />
          <span>{t('feature_photo')}</span>
        </li>
        <li className="flex gap-8 items-start">
          <LucideIcon name="map-pin" size={16} className="mt-2 shrink-0" />
          <span>{t('feature_map')}</span>
        </li>
        <li className="flex gap-8 items-start">
          <LucideIcon name="send" size={16} className="mt-2 shrink-0" />
          <span>{t('feature_send')}</span>
        </li>
      </ul>
    </div>
  );
};
