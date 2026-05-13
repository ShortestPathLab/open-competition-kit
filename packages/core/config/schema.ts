import { Schema as S } from "effect";
import { Meta, Shape } from "../hook";
import { Item } from "../common/shape";

export const Extendable = S.Struct({ with: S.Array(S.String) });

export const FormConfig = S.Struct({
  ...Meta.fields,
  shape: S.Array(S.Struct({ ...Shape.fields, ...Meta.fields })),
});

export const LeaderboardConfig = S.Struct({
  ...Meta.fields,
  shape: S.Array(Shape),
});

export const TrackConfig = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
  description: S.optional(S.String),
  overview: S.optional(S.String),
  rules: S.optional(S.String),
  form: S.Struct({ ...Extendable.fields, ...FormConfig.fields }),
});

export const CompetitionConfig = S.Struct({
  ...Item.fields,
  ...Extendable.fields,
  organiser: S.optional(S.String),
  description: S.optional(S.String),
  overview: S.optional(S.String),
  rules: S.optional(S.String),
  tracks: S.Array(TrackConfig),
  runner: S.Struct({ ...Extendable.fields, body: S.optional(S.String) }),
  leaderboards: S.Array(
    S.Struct({
      ...Item.fields,
      ...Extendable.fields,
      ...LeaderboardConfig.fields,
    }),
  ),
});

export const Config = S.Struct({
  appName: S.String,
  appDescription: S.String,
  auth: S.Record({ key: S.String, value: S.Any }),
  competitions: S.Array(CompetitionConfig),
  db: S.Struct({}),
  secrets: S.optional(S.Record({ key: S.String, value: S.String })),
  ...Extendable.fields,
});

export type Config = S.Schema.Type<typeof Config>;
export type Form = S.Schema.Type<typeof FormConfig>;
export type Leaderboard = S.Schema.Type<typeof LeaderboardConfig>;
export type CompetitionConfig = S.Schema.Type<typeof CompetitionConfig>;
export type Extendable = S.Schema.Type<typeof Extendable>;
export type TrackConfig = S.Schema.Type<typeof TrackConfig>;

export const decode = S.decodeUnknown(Config, { onExcessProperty: "preserve" });
