'use client';

import { useMemo, useState } from 'react';
import { FormControl, FormErrorMessage, Textarea } from '@sk-web-gui/react';
import { FileUpload, CustomOnChangeEventUploadFile, UploadFile } from '@sk-web-gui/forms';
import { useTranslation } from 'react-i18next';
import { useWizardStore } from '@stores/wizard-store';
import { OrigoMap } from '@components/origo-map/origo-map';
import { WizardNavigation } from '../wizard-navigation';

interface ReportStepProps {
  onBack?: () => void;
}

const MAX_UPLOAD_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const ReportStep = ({ onBack }: ReportStepProps) => {
  const { t } = useTranslation('report');
  const {
    images,
    addImages,
    removeImage,
    description,
    setDescription,
    mapLocation,
  } = useWizardStore();

  const [showErrors, setShowErrors] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const missingImage = images.length === 0;
  const missingLocation = mapLocation === null;

  const handleValidateNext = (): boolean => {
    if (missingImage || missingLocation) {
      setShowErrors(true);
      const firstErrorId = missingImage ? 'section-images' : 'section-location';
      document.getElementById(firstErrorId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  const handleFileChange = (e: CustomOnChangeEventUploadFile) => {
    if (e.target.value) {
      const pickedFiles = e.target.value.map((uploadFile) => uploadFile.file);
      const acceptedFiles = pickedFiles.filter((file) => file.size <= MAX_UPLOAD_FILE_SIZE_BYTES);
      const rejectedFiles = pickedFiles.length - acceptedFiles.length;

      if (rejectedFiles > 0) {
        setFileError(t('error_file_too_large'));
      } else {
        setFileError(null);
      }

      if (acceptedFiles.length > 0) {
        addImages(acceptedFiles);
      }
    }
  };

  const uploadFiles: UploadFile[] = useMemo(
    () =>
      images.map((file, index) => {
        const lastDot = file.name.lastIndexOf('.');
        const name = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
        const ending = lastDot !== -1 ? file.name.substring(lastDot + 1) : '';
        return {
          id: `${file.name}-${index}`,
          file,
          meta: { name, ending },
        };
      }),
    [images]
  );

  const handleRemoveFile = (file: UploadFile) => {
    const index = uploadFiles.indexOf(file);
    if (index !== -1) {
      removeImage(index);
    }
  };

  return (
    <div className="flex flex-col gap-32">
      <div>
        <h2 className="text-h3-sm md:text-h3-md mb-8">{t('title')}</h2>
        <p className="text-base text-dark-secondary">{t('description')}</p>
      </div>

      {/* Image upload */}
      <section id="section-images" className="flex flex-col gap-16">
        <h3 className="text-h4-sm md:text-h4-md font-semibold">{t('images_title')}</h3>

        <FormControl invalid={(showErrors && missingImage) || Boolean(fileError)} className="w-full">
          <FileUpload.Field
            onChange={handleFileChange}
            accept={['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic']}
            allowMultiple
            variant="horizontal"
            className="w-full"
          />

          {uploadFiles.length > 0 && (
            <FileUpload.List>
              {uploadFiles.map((file, index) => (
                <FileUpload.ListItem
                  key={file.id}
                  file={file}
                  index={index}
                  actionsProps={{
                    showRemove: true,
                    onRemove: handleRemoveFile,
                  }}
                />
              ))}
            </FileUpload.List>
          )}

          {showErrors && missingImage && (
            <FormErrorMessage>{t('error_no_image')}</FormErrorMessage>
          )}
          {fileError && <FormErrorMessage>{fileError}</FormErrorMessage>}
        </FormControl>
      </section>

      {/* Map */}
      <section id="section-location" className="flex flex-col gap-16">
        <h3 className="text-h4-sm md:text-h4-md font-semibold">{t('location_title')}</h3>
        <FormControl invalid={showErrors && missingLocation} className="w-full">
          <OrigoMap />
          {showErrors && missingLocation && (
            <FormErrorMessage>{t('error_no_location')}</FormErrorMessage>
          )}
        </FormControl>
      </section>

      {/* Description */}
      <section className="flex flex-col gap-16">
        <h3 className="text-h4-sm md:text-h4-md font-semibold">{t('description_title')}</h3>
        <FormControl className="w-full">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('description_placeholder')}
            rows={6}
            className="w-full min-h-[15rem]"
          />
        </FormControl>
      </section>

      <WizardNavigation onBack={onBack} onNext={handleValidateNext} />
    </div>
  );
};
