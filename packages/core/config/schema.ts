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
  form: Extendable,
});

export const CompetitionConfig = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
  tracks: S.Array(TrackConfig),
  runner: Extendable,
  leaderboards: S.Array(Extendable),
});

export const Config = S.Struct({
  competitions: S.Array(CompetitionConfig),
  db: S.Struct({}),
  ...Extendable.fields,
});

export type Config = S.Schema.Type<typeof Config>;

export type Extendable = S.Schema.Type<typeof Extendable>;

export const decode = S.decodeUnknown(Config);
