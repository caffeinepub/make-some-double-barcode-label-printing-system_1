import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { PrintJob } from '../backend';
import { useBackendAvailability } from '../state/backendAvailabilityStore';
import { isCanisterStoppedError, getCanisterStoppedMessage } from '../utils/icErrors';

export function useSubmitPrintJob() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { markStopped, markAvailable } = useBackendAvailability();

  return useMutation({
    mutationFn: async ({ prefix, leftSerial, rightSerial }: { prefix: string; leftSerial: string; rightSerial: string }) => {
      if (!actor) throw new Error('Actor not available');
      const result = await actor.submitPrintJob(prefix, leftSerial, rightSerial);
      markAvailable();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printHistory'] });
    },
    onError: (error: any) => {
      if (isCanisterStoppedError(error)) {
        markStopped(getCanisterStoppedMessage());
      }
    },
  });
}

export function useGetPrintHistory() {
  const { actor, isFetching } = useActor();
  const { markAvailable } = useBackendAvailability();

  return useQuery<PrintJob[]>({
    queryKey: ['printHistory'],
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.getPrintHistory();
      markAvailable();
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useIncreasePrintCount() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { markStopped, markAvailable } = useBackendAvailability();

  return useMutation({
    mutationFn: async (jobId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      await actor.increasePrintCount(jobId);
      markAvailable();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printHistory'] });
    },
    onError: (error: any) => {
      if (isCanisterStoppedError(error)) {
        markStopped(getCanisterStoppedMessage());
      }
    },
  });
}
