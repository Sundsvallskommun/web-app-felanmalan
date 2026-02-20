'use client';

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage = ({ message }: ErrorMessageProps) => {
  return (
    <div className="rounded-lg border border-error bg-error-surface-primary p-16 text-error">
      <p>{message}</p>
    </div>
  );
};
