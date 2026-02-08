import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useBackendAvailability } from '../state/backendAvailabilityStore';

export default function BackendAvailabilityIndicator() {
  const { isAvailable, lastError } = useBackendAvailability();

  // Don't show anything if backend is available
  if (isAvailable) {
    return null;
  }

  return (
    <Badge variant="destructive" className="gap-2 px-3 py-1.5 text-sm font-medium">
      <AlertCircle className="w-4 h-4" />
      Backend Unavailable
    </Badge>
  );
}
