import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import sdk, { unsafe } from "@open-competition-kit/sdk";
import { ensureAdmin } from "src/lib/admin";

const getFirstCompetitionId = createServerFn({ method: "GET" }).handler(
  async (): Promise<string | null> => {
    await ensureAdmin();
    const config = await unsafe(sdk.config.get());
    return config.competitions[0]?.id ?? null;
  },
);

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    // Land on whichever competition this deployment actually has, instead of the
    // hardcoded `gppc-2025` that only ever existed in the mockups.
    const competitionId = await getFirstCompetitionId();

    if (!competitionId) throw redirect({ to: "/competitions" });

    throw redirect({
      to: "/dashboard/$competitionId/overview",
      params: { competitionId },
    });
  },
});
