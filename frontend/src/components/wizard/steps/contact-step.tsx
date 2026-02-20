'use client';

import { FormControl, FormLabel, Input } from '@sk-web-gui/react';
import { useTranslation } from 'react-i18next';
import { useWizardStore } from '@stores/wizard-store';
import { WizardNavigation } from '../wizard-navigation';

export const ContactStep = () => {
  const { t } = useTranslation('contact');
  const {
    email,
    setEmail,
    phone,
    setPhone,
  } = useWizardStore();

  return (
    <div className="flex flex-col gap-32">
      <div>
        <h2 className="text-h3-sm md:text-h3-md mb-8">{t('title')}</h2>
        <p className="text-base text-dark-secondary">{t('description')}</p>
      </div>

      <div className="flex flex-col gap-16">
        <FormControl className="w-full">
          <FormLabel>{t('email')}</FormLabel>
          <Input
            className="w-full"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('email_placeholder')}
          />
        </FormControl>
        <FormControl className="w-full">
          <FormLabel>{t('phone')}</FormLabel>
          <Input
            className="w-full"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('phone_placeholder')}
          />
        </FormControl>
      </div>

      <WizardNavigation />
    </div>
  );
};
