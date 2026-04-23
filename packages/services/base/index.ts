import { differenceWith, keyBy, mapAsync } from "es-toolkit";
import sdk, {
  type Competition,
  type CompetitionConfigShape,
  type Track,
  type TrackCreate,
} from "sdk";
import { unsafe } from "sdk";

type SyncResult = {
  competitionsCreated: number;
  competitionsUpdated: number;
  tracksCreated: number;
  tracksUpdated: number;
};

type ConfigTrackRecord = TrackCreate & {
  id: string;
  name: string;
  competition: string;
};

const sameId = (a: { id: string }, b: { id: string }) => a.id === b.id;

async function createMissingCompetitions(
  configCompetitions: readonly CompetitionConfigShape[],
) {
  const dbCompetitions = await unsafe(sdk.competitions.list({}));
  const missing = differenceWith(configCompetitions, dbCompetitions, sameId);

  await mapAsync(missing, (competition) =>
    unsafe(
      sdk.competitions.create({
        id: competition.id,
        name: competition.name,
      }),
    ),
  );

  return { dbCompetitions, created: missing.length };
}

async function updateChangedCompetitions(
  configCompetitions: readonly CompetitionConfigShape[],
  dbCompetitions: readonly Competition[],
) {
  const byId = keyBy(dbCompetitions, ({ id }) => id);
  const changed = configCompetitions.filter(
    (competition) => byId[competition.id]?.name !== competition.name,
  );

  await mapAsync(changed, (competition) =>
    unsafe(
      sdk.competitions.update({
        id: competition.id,
        name: competition.name,
      }),
    ),
  );

  return changed.length;
}

async function createMissingTracks(competition: CompetitionConfigShape) {
  const dbTracks = await unsafe(
    sdk.tracks.list({ competition: competition.id }),
  );
  const configTracks = competition.tracks.map(
    (track) =>
      ({
        id: track.id,
        name: track.name,
        competition: competition.id,
      }) satisfies ConfigTrackRecord,
  );
  const missing = differenceWith(configTracks, dbTracks, sameId);

  await mapAsync(missing, (track) =>
    unsafe(
      sdk.tracks.create({
        id: track.id,
        name: track.name,
        competition: competition.id,
      }),
    ),
  );

  return { dbTracks, configTracks, created: missing.length };
}

async function updateChangedTracks(
  configTracks: ConfigTrackRecord[],
  dbTracks: readonly Track[],
) {
  const byId = keyBy(dbTracks, ({ id }) => id);
  const changed = configTracks.filter((track) => {
    const current = byId[track.id];
    return (
      current != null &&
      (current.name !== track.name || current.competition !== track.competition)
    );
  });

  await mapAsync(changed, (track) =>
    unsafe(
      sdk.tracks.update({
        id: track.id,
        name: track.name,
        competition: track.competition,
      }),
    ),
  );

  return changed.length;
}

export async function bindConfigToDatabase(): Promise<SyncResult> {
  const config = await unsafe(sdk.config.get());
  const configCompetitions = config.competitions;
  console.log(`Config found: ${configCompetitions.length} competitions`);

  const { dbCompetitions, created: competitionsCreated } =
    await createMissingCompetitions(configCompetitions);
  const competitionsUpdated = await updateChangedCompetitions(
    configCompetitions,
    dbCompetitions,
  );

  const trackResults = await mapAsync(
    configCompetitions,
    async (competition) => {
      const { dbTracks, configTracks, created } =
        await createMissingTracks(competition);
      const updated = await updateChangedTracks(configTracks, dbTracks);

      return { created, updated };
    },
  );

  return {
    competitionsCreated,
    competitionsUpdated,
    tracksCreated: trackResults.reduce(
      (total, result) => total + result.created,
      0,
    ),
    tracksUpdated: trackResults.reduce(
      (total, result) => total + result.updated,
      0,
    ),
  };
}

export async function startBaseService() {
  const result = await bindConfigToDatabase();
  console.log("Configuration bound to database", result);
}

await startBaseService();
