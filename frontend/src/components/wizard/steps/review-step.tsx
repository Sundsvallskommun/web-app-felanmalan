'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@sk-web-gui/react';
import LucideIcon from '@sk-web-gui/lucide-icon';
import { useWizardStore } from '@stores/wizard-store';
import { submitErrand } from '@services/report-service';
import { CreateErrandPayload } from '@interfaces/errand.types';
import { WizardNavigation } from '../wizard-navigation';
import { ErrorMessage } from '@components/ui/error-message';
import { useParams, useRouter } from 'next/navigation';
import i18nConfig from '@app/i18nConfig';

export const ReviewStep = () => {
  const { t } = useTranslation('review');
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || i18nConfig.defaultLocale;
  const {
    images,
    imagePreviews,
    description,
    mapLocation,
    email,
    phone,
    submitError,
    setSubmitState,
    setSubmitError,
    setErrandId,
    setErrandNumber,
    goToStep,
  } = useWizardStore();

  const handleEditReport = () => {
    goToStep(0);
  };

  const handleEditContact = () => {
    goToStep(1);
  };

  const handleSubmit = async () => {
    setSubmitState('submitting');
    setSubmitError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const title = description
        ? `Felanmälan – ${description.slice(0, 60)}${description.length > 60 ? '...' : ''}`
        : `Felanmälan ${today}`;

      const payload: CreateErrandPayload = {
        title,
        description: description || undefined,
        classification: { category: 'CONTACT_SUNDSVALL', type: 'INCIDENT_REPORT' },
        priority: 'MEDIUM',
      };

      const contactChannels: { type: string; value: string }[] = [];
      if (email) contactChannels.push({ type: 'EMAIL', value: email });
      if (phone) contactChannels.push({ type: 'PHONE', value: phone });

      if (contactChannels.length > 0) {
        payload.stakeholders = [{ contactChannels, role: 'CONTACT' }];
      }

      if (mapLocation) {
        payload.parameters = [
          { key: 'coordinates', values: [`${mapLocation.x},${mapLocation.y}`] },
          { key: 'coordinates_crs', values: ['EPSG:3006'] },
        ];
      }

      const result = await submitErrand(payload, images);

      setErrandId(result.id);
      setErrandNumber(result.errandNumber ?? null);
      setSubmitState('success');
      router.push(`/${locale}/tack`);
    } catch (err) {
      setSubmitState('error');
      setSubmitError(err instanceof Error ? err.message : t('submit_error'));
    }
  };

  const hasContact = email || phone;

  return (
    <div className="flex flex-col gap-24">
      <div>
        <h2 className="text-h3-sm md:text-h3-md mb-8">{t('title')}</h2>
        <p className="text-base text-dark-secondary">{t('description')}</p>
      </div>

      {/* Images */}
      {imagePreviews.length > 0 && (
        <div className="rounded-lg border border-divider p-24">
          <div className="flex justify-between items-center mb-16">
            <h3 className="text-h4-sm md:text-h4-md font-semibold">{t('section_images')}</h3>
            <Button variant="tertiary" size="sm" onClick={handleEditReport} leftIcon={<LucideIcon name="pencil" />}>
              {t('edit')}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-12">
            {imagePreviews.map((preview, index) => (
              <img
                key={index}
                src={preview}
                alt={`${t('image')} ${index + 1}`}
                className="w-full aspect-square object-cover rounded-lg border border-divider"
              />
            ))}
          </div>
        </div>
      )}

      {/* Location */}
      {mapLocation && (
        <div className="rounded-lg border border-divider p-24">
          <div className="flex justify-between items-center">
            <h3 className="text-h4-sm md:text-h4-md font-semibold">{t('section_location')}</h3>
            <Button variant="tertiary" size="sm" onClick={handleEditReport} leftIcon={<LucideIcon name="pencil" />}>
              {t('edit')}
            </Button>
          </div>
          <div className="flex items-center gap-8 mt-8">
            <LucideIcon name="map-pin" size={16} className="text-success" />
            <span>{t('location_selected')}</span>
          </div>
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="rounded-lg border border-divider p-24">
          <div className="flex justify-between items-center mb-16">
            <h3 className="text-h4-sm md:text-h4-md font-semibold">{t('section_description')}</h3>
            <Button variant="tertiary" size="sm" onClick={handleEditReport} leftIcon={<LucideIcon name="pencil" />}>
              {t('edit')}
            </Button>
          </div>
          <p>{description}</p>
        </div>
      )}

      {/* Contact */}
      {hasContact && (
        <div className="rounded-lg border border-divider p-24">
          <div className="flex justify-between items-center mb-16">
            <h3 className="text-h4-sm md:text-h4-md font-semibold">{t('section_contact')}</h3>
            <Button variant="tertiary" size="sm" onClick={handleEditContact} leftIcon={<LucideIcon name="pencil" />}>
              {t('edit')}
            </Button>
          </div>
          <div className="flex flex-col gap-8">
            {email && (
              <div className="flex gap-8">
                <span className="font-semibold">{t('email')}:</span>
                <span>{email}</span>
              </div>
            )}
            {phone && (
              <div className="flex gap-8">
                <span className="font-semibold">{t('phone')}:</span>
                <span>{phone}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {submitError && <ErrorMessage message={submitError} />}

      <WizardNavigation onSubmit={handleSubmit} />
    </div>
  );
};
