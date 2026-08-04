export type TrackSummary = {
  id: string;
  name: string;
  description: string;
  overview: string;
  rules: string;
  /** The organiser's picture for this track, when they set one. */
  icon?: string;
  competitionId: string;
};

export type CompetitionSummary = {
  id: string;
  name: string;
  organiser: string;
  description: string;
  overview: string;
  rules: string;
  /** The organiser's picture for this competition, when they set one. */
  icon?: string;
  tracks: TrackSummary[];
  /**
   * Only ever `"draft"` for an organiser, since nobody else is handed a draft in
   * the first place. It exists so their pages can say so.
   */
  visibility?: string;
};

export type SubmissionSummary = {
  id: string;
  body: string;
  /**
   * Which attempt at this track it was, counting from one.
   *
   * The id is a cuid, which tells a competitor nothing and is unpleasant to say
   * out loud. Numbering runs per track because that is the unit a competitor is
   * given: the gates a package enforces are counted per track, so "submission 3"
   * is the same 3 an attempt quota is talking about.
   */
  number: number;
};

export type UserSubmissionSummary = SubmissionSummary & {
  trackId: string;
  trackName: string;
  competitionId: string;
  competitionName: string;
};

export type EnrolmentSummary = {
  id: string;
  track: TrackSummary;
  competition: CompetitionSummary;
  submissions: SubmissionSummary[];
};
