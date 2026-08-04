import { competitions, tracks, unsafe } from "@open-competition-kit/sdk";
import { isVisibleTo } from "@open-competition-kit/sdk/visibility";
import { adminStatus } from "@/lib/admin";
import { startCase } from "es-toolkit";
import type { CompetitionSummary, TrackSummary } from "./types";
import { requireVisibleCompetition } from "./visibility";

function makeCompetitionDescription(name: string, trackCount: number) {
  if (trackCount === 0) return "No description yet.";
  if (trackCount === 1) return `${name} currently has 1 track available.`;
  return `${name} currently has ${trackCount} tracks available.`;
}

export async function getCompetitionSummary(
  id: string,
): Promise<CompetitionSummary> {
  const competition = await requireVisibleCompetition(id);
  const competitionTracks = await unsafe(tracks.of(competition));

  const competitionName = competition?.name ?? startCase(id);
  const trackSummaries: TrackSummary[] = competitionTracks.map((track) => ({
    id: track.id,
    name: track.name ?? startCase(track.id),
    description: track.description ?? "No description",
    overview: track.overview ?? "",
    rules: track.rules ?? "",
    icon: track.icon,
    competitionId: id,
  }));

  // Field by field rather than by spreading the config node. What is spread is
  // the whole of a competition as configured — its runner, its leaderboards,
  // every form it declares and every field an installed package contributed —
  // and all of it was being handed to the browser on every page that names a
  // competition, including the index, which names all of them at once. The
  // banner made that expensive enough to notice: it is a picture, and it is the
  // one field here that can be a quarter of a megabyte on its own.
  return {
    id,
    name: competitionName,
    organiser: competition.organiser || "OpenCompetitionKit",
    description:
      competition.description ||
      makeCompetitionDescription(competitionName, trackSummaries.length),
    overview: competition.overview ?? "",
    rules: competition.rules ?? "",
    icon: competition.icon,
    visibility: competition.visibility,
    tracks: trackSummaries,
  };
}

/**
 * The competition's banner, on its own.
 *
 * Kept out of the summary because of its size and how rarely it is wanted. A
 * banner is a picture, an inlined one runs to hundreds of kilobytes, and the
 * summary is fetched for every card on the index — which would mean shipping
 * every competition's banner to draw a page that paints none of them. Only the
 * pages inside a competition ask, and they ask once.
 *
 * Behind the same visibility check as everything else here, so a draft does not
 * leak its existence through a picture.
 */
export async function getCompetitionBanner(
  id: string,
): Promise<string | undefined> {
  const competition = await requireVisibleCompetition(id);
  return competition.banner;
}

export async function listCompetitionSummaries(): Promise<
  CompetitionSummary[]
> {
  const [competitionRecords, admin] = await Promise.all([
    unsafe(competitions.list({})),
    adminStatus(),
  ]);
  // Filtered before the summaries are built, not after: `getCompetitionSummary`
  // throws on a draft, so mapping the unfiltered list would reject the whole
  // index the moment one competition went unpublished.
  return Promise.all(
    competitionRecords
      .filter((competition) => isVisibleTo(competition, admin.isAdmin))
      .map((competition) => getCompetitionSummary(competition.id)),
  );
}

export async function getTrackSummary(trackId: string) {
  const track = await unsafe(tracks.get(trackId));
  const competition = await getCompetitionSummary(track.competition);
  return competition.tracks.find((candidate) => candidate.id === trackId);
}
