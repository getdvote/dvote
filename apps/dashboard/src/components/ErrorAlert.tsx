import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { errorMessage } from '../lib/api';

/** Red alert for a failed request or action. Renders nothing when there's no error. */
export function ErrorAlert({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle />
      <AlertDescription>{typeof error === 'string' ? error : errorMessage(error)}</AlertDescription>
    </Alert>
  );
}
