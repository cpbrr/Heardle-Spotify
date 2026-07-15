interface StatusMessageProps {
  children: React.ReactNode;
  tone?: 'info' | 'error';
}

export function StatusMessage({ children, tone = 'info' }: StatusMessageProps) {
  return (
    <p className={`status-message status-message--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
