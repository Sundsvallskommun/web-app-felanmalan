'use client';

import { Button } from '@sk-web-gui/react';
import LucideIcon from '@sk-web-gui/lucide-icon';
import { useParams, usePathname, useRouter } from 'next/navigation';
import i18nConfig from '@app/i18nConfig';

export const LanguageSwitcher = () => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ locale?: string }>();
  const currentLocale = params?.locale || i18nConfig.defaultLocale;

  const targetLocale = currentLocale === 'sv' ? 'en' : 'sv';
  const label = currentLocale === 'sv' ? 'English' : 'Svenska';

  const handleSwitch = () => {
    const pathWithoutLocale = pathname.replace(`/${currentLocale}`, '') || '/';
    router.push(`/${targetLocale}${pathWithoutLocale}`);
  };

  return (
    <Button
      variant="tertiary"
      size="sm"
      onClick={handleSwitch}
      leftIcon={<LucideIcon name="globe" size={16} />}
    >
      {label}
    </Button>
  );
};
