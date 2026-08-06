/**
 * Restarting the service, and knowing when it came back.
 *
 * Config is read once at startup, so a saved change applies at the next one. The
 * kit will stop this process on request; what it cannot do is tell the browser
 * when a new one is answering, because the answer has to come from the process
 * that replaced it.
 *
 * Hence the boot id. Each process makes one when this module loads and hands it
 * out with every status reply, so the page can tell "the service is back" from
 * "the service never went away", which a plain health check cannot: for the
 * fraction of a second between asking to restart and exiting, the old process
 * answers exactly like a new one.
 */
import sdk, { unsafe, type RestartSupport } from "@open-competition-kit/sdk";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ensureAdmin } from "./admin";

export type { RestartSupport };

const BOOT = crypto.randomUUID();

export type ServiceStatus = {
  /** Changes when the process does, and only then. */
  boot: string;
  support: RestartSupport;
};

export const getServiceStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ServiceStatus> => {
    await ensureAdmin();
    return { boot: BOOT, support: await unsafe(sdk.lifecycle.support()) };
  },
);

const restartService = createServerFn({ method: "POST" }).handler(
  async (): Promise<RestartSupport> => {
    await ensureAdmin();
    return unsafe(sdk.lifecycle.restart());
  },
);

export function useServiceStatus() {
  const status = useServerFn(getServiceStatus);
  return useQuery({
    queryKey: ["serviceStatus"],
    queryFn: () => status() as Promise<ServiceStatus>,
    // A running process does not change its mind about either answer, and the
    // one thing that would change them takes the process with it.
    staleTime: Infinity,
    retry: false,
  });
}

export function useRestartService() {
  const restart = useServerFn(restartService);
  return useMutation({ mutationFn: () => restart() as Promise<RestartSupport> });
}
