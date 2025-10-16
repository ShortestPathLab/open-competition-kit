import { Schema } from "effect";

export const Item = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

export const Extendable = Schema.Struct({
  with: Schema.Array(Schema.String),
});

export const TrackConfig = Schema.Struct({
  ...Item.fields,
  ...Extendable.fields,
  form: Extendable,
});

export const CompetitionConfig = Schema.Struct({
  ...Item.fields,
  ...Extendable.fields,
  tracks: Schema.Array(TrackConfig),
  runner: Extendable,
  leaderboards: Schema.Array(Extendable),
});

export const Config = Schema.Struct({
  competitions: Schema.Array(CompetitionConfig),
  ...Extendable.fields,
});

export const decode = Schema.decodeUnknown(Config);
