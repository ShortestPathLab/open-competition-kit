import { startCase } from "es-toolkit";
import sdk from "sdk";

export type TrackSummary = {
  id: string;
  name: string;
  description: string;
  competitionId: string;
};

export type CompetitionSummary = {
  id: string;
  name: string;
  organizer: string;
  description: string;
  tracks: TrackSummary[];
};

export type EnrolmentSummary = {
  id: string;
  track: TrackSummary;
  competition: CompetitionSummary;
};

const fallbackTracks = [
  {
    id: "dynamic",
    name: "Dynamic",
    description:
      "Navigate evolving grid maps that change between queries while maintaining strong performance.",
  },
  {
    id: "anyangle",
    name: "Anyangle",
    description:
      "Plan paths that are not constrained to grid edges, balancing geometric freedom with fast search.",
  },
  {
    id: "classic",
    name: "Classic",
    description:
      "Solve standard benchmark instances with reliable, comparable submissions across the field.",
  },
];

const fallbackCompetitions = [
  { id: "gppc-2025", name: "GPPC 2025", organizer: "catalogapp.io" },
  {
    id: "gppc-2024",
    name: "GPPC 2024 (Elapsed)",
    organizer: "catalogapp.io",
  },
  { id: "single-agent-1", name: "Single agent", organizer: "catalogapp.io" },
  { id: "single-agent-2", name: "Single agent", organizer: "catalogapp.io" },
  { id: "single-agent-3", name: "Single agent", organizer: "catalogapp.io" },
  { id: "single-agent-4", name: "Single agent", organizer: "catalogapp.io" },
];

async function getConfig() {
  return (await sdk.config.get()).value;
}

export async function getCompetitionSummary(
  id: string,
): Promise<CompetitionSummary> {
  const config = await getConfig();
  const configCompetition = config?.competitions?.find((c) => c.id === id);
  const dbCompetition = (await sdk.competitions.get(id)).value;

  const base =
    configCompetition ??
    dbCompetition ??
    fallbackCompetitions.find((competition) => competition.id === id);

  const dbTracks = (await sdk.tracks.list({ competition: id })).value ?? [];
  const configTracks = configCompetition?.tracks ?? [];
  const tracksById = new Map<string, TrackSummary>();

  for (const track of [...configTracks, ...dbTracks]) {
    tracksById.set(track.id, {
      id: track.id,
      name: track.name,
      description:
        "description" in track && typeof track.description === "string"
          ? track.description
          : `${track.name} track for ${base?.name ?? startCase(id)}.`,
      competitionId: id,
    });
  }

  if (tracksById.size === 0) {
    for (const track of fallbackTracks) {
      tracksById.set(track.id, { ...track, competitionId: id });
    }
  }

  const organizer = (base as { organizer?: string } | undefined)?.organizer;

  return {
    id,
    name: base?.name ?? startCase(id),
    organizer: organizer ?? "catalogapp.io",
    description: `${base?.name ?? startCase(id)} competition details and tracks.`,
    tracks: [...tracksById.values()],
  };
}

export async function listCompetitionSummaries(): Promise<CompetitionSummary[]> {
  const config = await getConfig();
  const dbCompetitions = (await sdk.competitions.list({})).value ?? [];
  const ids = new Set<string>();

  for (const competition of fallbackCompetitions) ids.add(competition.id);
  for (const competition of config?.competitions ?? []) ids.add(competition.id);
  for (const competition of dbCompetitions) ids.add(competition.id);

  return Promise.all([...ids].map((id) => getCompetitionSummary(id)));
}

export async function getTrackSummary(competitionId: string, trackId: string) {
  const competition = await getCompetitionSummary(competitionId);
  return competition.tracks.find((track) => track.id === trackId);
}

export async function isEnrolledInTrack(userId: string, trackId: string) {
  const enrolments = (await sdk.enrolments.list({ user: userId, track: trackId }))
    .value;
  return Boolean(enrolments?.length);
}

export async function listUserEnrolments(
  userId: string,
): Promise<EnrolmentSummary[]> {
  const enrolments = (await sdk.enrolments.list({ user: userId })).value ?? [];
  const competitions = await listCompetitionSummaries();

  return enrolments.map((enrolment) => {
    const competition =
      competitions.find((competition) =>
        competition.tracks.some((track) => track.id === enrolment.track),
      ) ?? competitions[0];
    const track =
      competition?.tracks.find((track) => track.id === enrolment.track) ??
      ({
        id: enrolment.track,
        name: startCase(enrolment.track),
        description: "Track details are not available yet.",
        competitionId: competition?.id ?? "",
      } satisfies TrackSummary);

    return {
      id: enrolment.id,
      track,
      competition:
        competition ??
        ({
          id: "",
          name: "Competition",
          organizer: "catalogapp.io",
          description: "",
          tracks: [track],
        } satisfies CompetitionSummary),
    };
  });
}
