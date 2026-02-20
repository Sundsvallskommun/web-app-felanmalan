'use client';

import { Spinner } from '@sk-web-gui/react';

interface LoaderProps {
  text?: string;
}

export const Loader = ({ text = 'Laddar...' }: LoaderProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-16 py-48">
      <Spinner size={4} />
      <span className="text-base text-dark-secondary">{text}</span>
    </div>
  );
};
