import { Schema as S } from "effect";

export const Item = S.Struct({
  id: S.String,
  name: S.String,
});

export const Extendable = S.Struct({
  with: S.Array(S.String),
});

export const TrackConfig = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
  description: S.optional(S.String),
  overview: S.optional(S.String),
  rules: S.optional(S.String),
  form: Extendable,
});

export const CompetitionConfig = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
  organiser: S.optional(S.String),
  description: S.optional(S.String),
  overview: S.optional(S.String),
  rules: S.optional(S.String),
  tracks: S.Array(TrackConfig),
  runner: S.Struct({
    ...Extendable.fields,
    body: S.optional(S.String),
  }),
  leaderboards: S.Array(Extendable),
});

export const Config = S.Struct({
  appName: S.String,
  appDescription: S.String,
  auth: S.Record({ key: S.String, value: S.Any }),
  competitions: S.Array(CompetitionConfig),
  db: S.Struct({}),
  ...Extendable.fields,
});

export type Config = S.Schema.Type<typeof Config>;
export type CompetitionConfig = S.Schema.Type<typeof CompetitionConfig>;
export type Extendable = S.Schema.Type<typeof Extendable>;
export type TrackConfig = S.Schema.Type<typeof TrackConfig>;

export const decode = S.decodeUnknown(Config);
