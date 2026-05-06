import { isEqual } from "es-toolkit";
import sdk, { type CompetitionConfig } from "sdk";
import { unsafe } from "sdk";

type SyncResult = {
  competitionsCreated: number;
  competitionsUpdated: number;
  tracksCreated: number;
  tracksUpdated: number;
};

function competitionDocument(competition: CompetitionConfig, index: number) {
  return {
    index,
    id: competition.id,
    name: competition.name,
    organiser: competition.organiser ?? "OpenCompetitionKit",
    description: competition.description ?? "No description yet.",
    overview: competition.overview ?? "",
    rules: competition.rules ?? "",
  };
}

function trackDocument(
  competition: CompetitionConfig,
  track: CompetitionConfig["tracks"][number],
  index: number,
) {
  return {
    index,
    id: track.id,
    name: track.name,
    competition: competition.id,
    description:
      track.description ?? `${track.name} track in ${competition.name}.`,
    overview: track.overview ?? "",
    rules: track.rules ?? "",
  };
}

export async function bindConfigToDatabase(): Promise<SyncResult> {
  const config = await unsafe(sdk.config.get());
  console.log(`Config found: ${config.competitions.length} competitions`);

  const dbCompetitions = await unsafe(sdk.competitions.list({}));
  const dbTracks = await unsafe(sdk.tracks.list({}));

  let competitionsCreated = 0;
  let competitionsUpdated = 0;
  let tracksCreated = 0;
  let tracksUpdated = 0;

  for (const [competition, i] of config.competitions.map(
    (c, i) => [c, i] as const,
  )) {
    const nextCompetition = competitionDocument(competition, i);
    const currentCompetition = dbCompetitions.find(
      ({ id }) => id === competition.id,
    );

    if (!currentCompetition) {
      await unsafe(sdk.competitions.create(nextCompetition));
      competitionsCreated++;
    } else if (!isEqual(nextCompetition, currentCompetition)) {
      await unsafe(sdk.competitions.update(nextCompetition));
      competitionsUpdated++;
    }

    for (const [track, j] of competition.tracks.map(
      (c, i) => [c, i] as const,
    )) {
      const nextTrack = trackDocument(competition, track, j);
      const currentTrack = dbTracks.find(({ id }) => id === track.id);

      if (!currentTrack) {
        await unsafe(sdk.tracks.create(nextTrack));
        tracksCreated++;
      } else if (!isEqual(nextTrack, currentTrack)) {
        await unsafe(sdk.tracks.update(nextTrack));
        tracksUpdated++;
      }
    }
  }

  return {
    competitionsCreated,
    competitionsUpdated,
    tracksCreated,
    tracksUpdated,
  };
}

export async function startBaseService() {
  const result = await bindConfigToDatabase();
  console.log("Configuration bound to database", result);
}

await startBaseService();
