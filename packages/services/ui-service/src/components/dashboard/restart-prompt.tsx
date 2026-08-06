import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { getServiceStatus, useRestartService, useServiceStatus } from "@/lib/dashboard-restart-fn";

/** How often to ask whether the service is answering again. */
const POLL_MS = 1000;

/**
 * How long to wait before saying so.
 *
 * Long enough for a container to be pulled back up and for the config, the
 * packages and the database to be read again, which is the slow part. Short
 * enough that somebody watching a spinner finds out that nothing is coming.
 */
const LATE_MS = 60_000;

type Phase = "ask" | "waiting" | "late";

/**
 * The prompt after a saved change.
 *
 * Configuration is read at startup, so a save takes effect at the next one. That
 * is a sentence an organiser should never have to know, which is why this
 * appears the moment their change lands rather than waiting to be discovered.
 *
 * It stops short of promising. Whether the service comes back is the deployment's
 * business, not the kit's, so the wording says what pressing the button does and
 * the waiting state says plainly when nothing has come back.
 */
export function RestartPrompt({
  open,
  onDismiss,
}: {
  open: boolean;
  /** Called when the reader chooses to stay on the old config for now. */
  onDismiss: () => void;
}) {
  const { data: status } = useServiceStatus();
  const restart = useRestartService();
  const fetchStatus = useServerFn(getServiceStatus);

  const [phase, setPhase] = useState<Phase>("ask");
  // The process that was answering when the button was pressed. The one that
  // answers next is either the same one, still shutting down, or the new one.
  const [was, setWas] = useState<string>();

  useEffect(() => {
    if (phase === "ask" || !was) return;

    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();

    const ask = async () => {
      try {
        const now = (await fetchStatus()) as { boot: string };
        if (stop) return;
        if (now.boot !== was) {
          // The page was rendered by the process that just went away, so
          // everything on it is from the old config.
          window.location.reload();
          return;
        }
      } catch {
        // Refused, timed out, or answered with something that is not JSON. All
        // of them mean the service is not up yet, which is the expected state
        // for most of this wait.
      }

      if (stop) return;
      if (Date.now() - started > LATE_MS) setPhase("late");
      timer = setTimeout(ask, POLL_MS);
    };

    timer = setTimeout(ask, POLL_MS);

    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [phase, was, fetchStatus]);

  const support = status?.support;

  const begin = async () => {
    setWas(status?.boot);
    setPhase("waiting");
    await restart.mutateAsync().catch(() => undefined);
  };

  const waiting = phase === "waiting" || phase === "late";

  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? undefined : onDismiss())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            {phase === "late" ? (
              <TriangleAlert className="text-warning" />
            ) : waiting ? (
              <Spinner className="size-6" />
            ) : (
              <RefreshCw />
            )}
          </AlertDialogMedia>

          <AlertDialogTitle>
            {phase === "late"
              ? "Still waiting"
              : waiting
                ? "Restarting"
                : "Restart to apply your changes"}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {phase === "late" ? (
              <>
                The service has not answered for a minute. It was stopped, so something has to start
                it again. {support?.detail}
              </>
            ) : waiting ? (
              "Waiting for the service to answer again. This page reloads by itself when it does."
            ) : (
              <>
                Your changes are saved to the config file. Open Competition Kit reads that file when
                it starts, so they apply at the next start.{" "}
                {support?.restartable
                  ? support.detail
                  : (support?.detail ?? "Restart the service to pick them up.")}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {waiting ? (
            <AlertDialogAction variant="outline" onClick={() => window.location.reload()}>
              Reload now
            </AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel>{support?.restartable ? "Later" : "Close"}</AlertDialogCancel>
              {support?.restartable ? (
                <AlertDialogAction onClick={begin} disabled={restart.isPending}>
                  Restart now
                </AlertDialogAction>
              ) : null}
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
