'use client';

import { Button } from '@sk-web-gui/react';
import LucideIcon from '@sk-web-gui/lucide-icon';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useWizardStore } from '@stores/wizard-store';
import i18nConfig from '@app/i18nConfig';

const ThankYouPage = () => {
  const { t } = useTranslation('review');
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || i18nConfig.defaultLocale;
  const { errandNumber, reset } = useWizardStore();

  const handleReportAnother = () => {
    reset();
    router.push(`/${locale}`);
  };

  return (
    <main className="main-container">
      <div className="max-w-[72rem] mx-auto px-[1.6rem] py-[2.4rem] w-full">
        <div className="flex flex-col items-center gap-24 py-48 text-center">
          <div className="w-64 h-64 rounded-full bg-gronsta-surface-primary flex items-center justify-center">
            <LucideIcon name="check" size={32} />
          </div>
          <h1 className="text-h2-sm md:text-h2-md">{t('thank_you_title')}</h1>
          <p className="text-large">{t('thank_you_description')}</p>
          {errandNumber && (
            <p className="text-base text-dark-secondary">
              {t('errand_number')}: <strong>{errandNumber}</strong>
            </p>
          )}
          <Button variant="primary" onClick={handleReportAnother} leftIcon={<LucideIcon name="plus" />}>
            {t('report_another')}
          </Button>
        </div>
      </div>
    </main>
  );
};

export default ThankYouPage;
