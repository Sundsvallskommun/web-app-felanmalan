'use client';

import { ProgressStepper } from '@sk-web-gui/progress-stepper';
import { useTranslation } from 'react-i18next';
import { useWizardStore } from '@stores/wizard-store';

export const WizardProgress = () => {
  const { t } = useTranslation('wizard');
  const currentStep = useWizardStore((s) => s.currentStep);

  const steps = [
    t('step_report'),
    t('step_contact'),
    t('step_review'),
  ];

  return (
    <ProgressStepper
      steps={steps}
      current={currentStep}
      size="sm"
      rounded
      labelPosition="bottom"
    />
  );
};
