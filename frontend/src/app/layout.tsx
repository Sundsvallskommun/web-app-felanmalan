import '@styles/tailwind.scss';
import { ReactNode } from 'react';
import AppProvider from '@components/app-provider/app-provider';
import { StagingGate } from '@components/staging-gate/staging-gate';
import i18nConfig from './i18nConfig';
import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

interface RootLayoutProps {
  children: ReactNode;
}

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang={i18nConfig.defaultLocale}>
      <body>
        <AppProvider>
          <StagingGate>{children}</StagingGate>
        </AppProvider>
      </body>
    </html>
  );
};

export default RootLayout;
