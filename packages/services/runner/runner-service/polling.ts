type PollingOptions = {
  intervalMs: number;
  poll: () => Promise<void>;
  onError?: (error: unknown) => void;
};

export function createPollingWorker({ intervalMs, poll, onError = console.error }: PollingOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let running = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;

    try {
      await poll();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
      if (!stopped) {
        timer = setTimeout(() => {
          void tick();
        }, intervalMs);
      }
    }
  };

  return {
    start() {
      void tick();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
    /**
     * Whether a poll is in flight.
     *
     * For anything that needs to wait until this worker is between jobs, which
     * is what restarting to pick up a config change waits for.
     */
    busy: () => running,
    tick,
  };
}
