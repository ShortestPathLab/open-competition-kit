/**
 * The config, as the settings page reads and writes it.
 *
 * Both directions go through the kit rather than through anything this service
 * knows: `config.describe` hands over the fields the installed packages declare,
 * their labels and what is currently in them, and `config.set` takes edited
 * values back keyed by the same paths. Nothing here knows what a deadline or a
 * bucket name is, which is the point. A package that adds a field gets an editor
 * for it without a line changing on this side.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk, {
  reference,
  unsafe,
  type ConfigEdit,
  type ConfigNodeDescription,
  type ConfigWritability,
  type ConfigWriteResult,
} from "@open-competition-kit/sdk";
import { z } from "zod";
import { ensureAdmin } from "./admin";

export type { ConfigEdit, ConfigNodeDescription, ConfigWritability, ConfigWriteResult };

export type CompetitionConfigView = {
  id: string;
  name: string;
  organiser: string;
  description: string;
  tracks: { id: string; name: string; fields: number }[];
  leaderboards: { id: string; name: string; source: string }[];
  packages: string[];
  /**
   * The nodes an organiser could edit here, narrowed to this competition and the
   * blocks above it. A dashboard page for one competition has no business
   * listing another's tracks.
   */
  settings: ConfigNodeDescription[];
  database: { provider: string; configured: boolean };
  /** Where the values came from, so the page can say what an edit would change. */
  file: string;
};

const getCompetitionConfig = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }): Promise<CompetitionConfigView | null> => {
    await ensureAdmin();

    const config = await unsafe(sdk.config.get());
    const competition = config.competitions.find((entry) => entry.id === id);
    if (!competition) return null;

    const db = config.db as { provider?: string; url?: string };
    const described = await unsafe(sdk.config.describe());

    return {
      id: competition.id,
      name: competition.name ?? competition.id,
      organiser: competition.organiser ?? "Not set",
      description: competition.description ?? "",
      tracks: competition.tracks.map((track) => ({
        id: track.id,
        name: track.name ?? track.id,
        fields: track.form.shape.length,
      })),
      leaderboards: competition.leaderboards.map((leaderboard) => {
        // A package's field, read loosely for a summary line. Core takes no
        // position on where a board's rows come from.
        const from = (leaderboard as { from?: { output?: string } }).from;
        return {
          id: leaderboard.id,
          name: leaderboard.name ?? leaderboard.id,
          source: from ? (from.output ?? reference.std.output) : "static items",
        };
      }),
      packages: [...competition.with],
      // Narrowed to this competition and the blocks above it, since a dashboard
      // page for one competition has no business listing another's tracks. A
      // node with nothing editable on either side is dropped: it would render as
      // a titled panel with no controls in it.
      settings: described.filter(
        (node: ConfigNodeDescription) =>
          (node.core.length > 0 || node.sections.length > 0) &&
          (node.path === `config.competitions.${id}` ||
            node.path.startsWith(`config.competitions.${id}.`) ||
            !node.path.startsWith("config.competitions")),
      ),
      database: {
        provider: db?.provider ?? "Not set",
        // Never the connection string itself: it carries credentials.
        configured: Boolean(db?.url),
      },
      file: await unsafe(sdk.config.path()),
    };
  });

/**
 * A config value, which is any JSON value rather than only a scalar. A package
 * may declare a field that holds a list or an object, and the editor has to be
 * able to hand one back.
 */
const settingValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(settingValue),
    z.record(z.string(), settingValue),
  ]),
);

/**
 * An edit on the wire, where clearing a field has to be said out loud.
 *
 * `ConfigEdit` spells "unset this" as an `undefined` value, which is the right
 * shape in memory and does not survive being serialised: a key holding
 * `undefined` is a key that is not there once it has been through JSON, so
 * clearing a field would arrive as having edited nothing. The names go in a list
 * of their own and are put back on the other side.
 */
const editsInput = z.object({
  edits: z.array(
    z.object({
      path: z.string(),
      values: z.record(z.string(), settingValue),
      clear: z.array(z.string()),
      /**
       * What each edited field held when the form was drawn, so the kit can
       * refuse a save that would quietly overwrite somebody else's. Only the
       * fields whose value the page was actually given, which leaves out every
       * secret.
       */
      expect: z.record(z.string(), settingValue),
      /** Fields the form drew as empty, which `expect` cannot say in JSON. */
      expectAbsent: z.array(z.string()),
    }),
  ),
});

const setCompetitionConfig = createServerFn({ method: "POST" })
  .inputValidator(editsInput)
  .handler(async ({ data }): Promise<ConfigWriteResult> => {
    await ensureAdmin();

    const edits: ConfigEdit[] = data.edits.map((edit) => ({
      path: edit.path,
      values: {
        ...(edit.values as ConfigEdit["values"]),
        ...Object.fromEntries(edit.clear.map((field) => [field, undefined])),
      },
      expect: {
        ...(edit.expect as ConfigEdit["expect"]),
        ...Object.fromEntries(edit.expectAbsent.map((field) => [field, undefined])),
      },
    }));

    return unsafe(sdk.config.set(edits));
  });

/**
 * Whether this deployment can save a config change, asked before offering to.
 *
 * A config file mounted read only is an ordinary way to run this, and so is one
 * owned by a user the service is not. Both are invisible from the browser, and
 * finding out by pressing Save means finding out after typing everything.
 */
const getConfigWritability = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConfigWritability> => {
    await ensureAdmin();
    return unsafe(sdk.config.writable());
  },
);

export function useConfigWritability() {
  const probe = useServerFn(getConfigWritability);
  return useQuery({
    queryKey: ["configWritability"],
    queryFn: () => probe() as Promise<ConfigWritability>,
    // Whether a file is writable can change under a running process, but not
    // usually while somebody has one page open, and the save reports its own
    // failure regardless of what this said.
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompetitionConfig(competitionId: string) {
  const fetchConfig = useServerFn(getCompetitionConfig);
  return useQuery({
    queryKey: ["competitionConfig", competitionId],
    queryFn: () => fetchConfig({ data: competitionId }) as Promise<CompetitionConfigView | null>,
  });
}

/** The half of a record that survives JSON, and the names of the half that does not. */
const split = (values: Record<string, unknown> = {}) => ({
  present: Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)),
  absent: Object.entries(values)
    .filter(([, value]) => value === undefined)
    .map(([field]) => field),
});

export function useSetCompetitionConfig() {
  const setConfig = useServerFn(setCompetitionConfig);
  return useMutation({
    mutationFn: (edits: ConfigEdit[]) =>
      setConfig({
        data: {
          edits: edits.map((edit) => {
            const values = split(edit.values);
            const expect = split(edit.expect);
            return {
              path: edit.path,
              values: values.present,
              clear: values.absent,
              expect: expect.present,
              expectAbsent: expect.absent,
            };
          }),
        },
      }) as Promise<ConfigWriteResult>,
  });
}
