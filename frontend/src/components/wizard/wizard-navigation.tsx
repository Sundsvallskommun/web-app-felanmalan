'use client';

import { Button } from '@sk-web-gui/react';
import LucideIcon from '@sk-web-gui/lucide-icon';
import { useTranslation } from 'react-i18next';
import { useWizardStore } from '@stores/wizard-store';

interface WizardNavigationProps {
  onNext?: () => boolean | void;
  onSubmit?: () => void;
  onBack?: () => void;
  nextDisabled?: boolean;
}

export const WizardNavigation = ({ onNext, onSubmit, onBack, nextDisabled = false }: WizardNavigationProps) => {
  const { t } = useTranslation('common');
  const { currentStep, prevStep, nextStep, submitState } = useWizardStore();
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === 2;
  const isSubmitting = submitState === 'submitting';

  const handleNext = () => {
    if (onNext) {
      const result = onNext();
      if (result === false) return;
    }
    nextStep();
  };

  const handleSubmit = () => {
    onSubmit?.();
  };

  return (
    <div className="flex justify-between items-center pt-32 mt-32 border-t border-divider">
      <div>
        {isFirstStep ? (
          onBack && (
            <Button variant="tertiary" onClick={onBack} leftIcon={<LucideIcon name="arrow-left" />}>
              {t('back')}
            </Button>
          )
        ) : (
          <Button variant="tertiary" onClick={prevStep} leftIcon={<LucideIcon name="arrow-left" />}>
            {t('back')}
          </Button>
        )}
      </div>
      <div>
        {isLastStep ? (
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            loading={isSubmitting}
            rightIcon={<LucideIcon name="send" />}
          >
            {t('submit')}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={nextDisabled}
            rightIcon={<LucideIcon name="arrow-right" />}
          >
            {t('next')}
          </Button>
        )}
      </div>
    </div>
  );
};
