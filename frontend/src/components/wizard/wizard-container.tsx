'use client';

import { useWizardStore } from '@stores/wizard-store';
import { WizardProgress } from './wizard-progress';
import { ReportStep } from './steps/report-step';
import { ContactStep } from './steps/contact-step';
import { ReviewStep } from './steps/review-step';

interface WizardContainerProps {
  onBack?: () => void;
}

const WizardContainer = ({ onBack }: WizardContainerProps) => {
  const currentStep = useWizardStore((s) => s.currentStep);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <ReportStep onBack={onBack} />;
      case 1:
        return <ContactStep />;
      case 2:
        return <ReviewStep />;
      default:
        return <ReportStep />;
    }
  };

  return (
    <div className="max-w-[72rem] mx-auto px-[1.6rem] py-[2.4rem] w-full">
      <WizardProgress />
      {renderStep()}
    </div>
  );
};

export default WizardContainer;
