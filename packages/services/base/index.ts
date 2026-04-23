import { differenceWith, keyBy, mapAsync } from "es-toolkit";
import sdk, { unsafe } from "sdk";

type ConfigCompetition = {
  id: string;
  name: string;
  tracks: readonly ConfigTrack[];
};

type ConfigTrack = {
  id: string;
  name: string;
};

type DbCompetition = {
  id: string;
  name: string;
};

type DbTrack = {
  id: string;
  name: string;
  competition: string;
};

type SyncResult = {
  competitionsCreated: number;
  competitionsUpdated: number;
  tracksCreated: number;
  tracksUpdated: number;
};

const sameId = (a: { id: string }, b: { id: string }) => a.id === b.id;

async function createMissingCompetitions(
  configCompetitions: readonly ConfigCompetition[],
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
  configCompetitions: readonly ConfigCompetition[],
  dbCompetitions: readonly DbCompetition[],
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

async function createMissingTracks(competition: ConfigCompetition) {
  const dbTracks = await unsafe(
    sdk.tracks.list({ competition: competition.id }),
  );
  const configTracks = competition.tracks.map((track) => ({
    ...track,
    competition: competition.id,
  }));
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
  configTracks: DbTrack[],
  dbTracks: readonly DbTrack[],
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
  const configCompetitions =
    config.competitions as readonly ConfigCompetition[];
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
