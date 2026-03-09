/**
 * TEMPORÄR: Lösenordsspärr (gate) för staging-miljön.
 * Används enbart i test-/demosyfte för att förhindra obehörig åtkomst under PoC-fasen.
 * Ska tas bort helt vid lansering till produktion.
 */
'use client';

import { Button, FormControl, FormErrorMessage, FormLabel, Input } from '@sk-web-gui/react';
import { Logo } from '@sk-web-gui/logo';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { apiService } from '@services/api-service';
import { AxiosError } from 'axios';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

interface StagingGateProps {
  children: ReactNode;
}

const authorize = () => {
  sessionStorage.setItem('stage-authorized', 'true');
};

const ensureBasePath = () => {
  if (BASE_PATH && !window.location.pathname.startsWith(BASE_PATH)) {
    window.location.href = BASE_PATH;
  }
};

export const StagingGate = ({ children }: StagingGateProps) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('stage-authorized') === 'true') {
      setAuthorized(true);
      return;
    }

    // Check if gate is enabled — if STAGE_PASSWORD is not set, backend returns authorized: true
    apiService
      .post<{ authorized: boolean }>('/auth/verify', { password: '' })
      .then((res) => {
        if (res.data.authorized) {
          authorize();
          ensureBasePath();
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      })
      .catch(() => {
        setAuthorized(false);
      });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiService.post<{ authorized: boolean }>('/auth/verify', { password });
      if (res.data.authorized) {
        authorize();
        ensureBasePath();
        setAuthorized(true);
      }
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 401) {
        setError('Fel lösenord. Försök igen.');
      } else {
        setError('Kunde inte ansluta till servern. Försök igen senare.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Still checking sessionStorage
  if (authorized === null) {
    return null;
  }

  if (authorized) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-32 py-48 px-16 text-center min-h-screen bg-vattjom-background-100">
      <Logo variant="symbol" className="w-80 h-80" />

      <div className="flex flex-col gap-12 max-w-md">
        <h1 className="text-h2-sm md:text-h2-md">Felanmälan</h1>
        <p className="text-large text-dark-secondary">Ange lösenord för att komma åt tjänsten.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-16 max-w-sm w-full">
        <FormControl className="w-full">
          <FormLabel>Lösenord</FormLabel>
          <Input
            type="password"
            size="lg"
            className="!w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </FormControl>

        {error && <FormErrorMessage>{error}</FormErrorMessage>}

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          Logga in
        </Button>
      </form>
    </div>
  );
};
