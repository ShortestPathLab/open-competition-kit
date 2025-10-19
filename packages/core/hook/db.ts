import { Schema as S } from "effect";
import { hook } from "./hook";

export const { Number, Boolean, Date, String, Int } = S;

export const Id = S.String.annotations({
  identifier: "open-competition-kit/db/Id",
});

export const schemas = {
  competition: S.Struct({
    id: Id,
    name: S.String,
  }),
  track: S.Struct({
    id: Id,
    name: S.String,
    competition: S.String,
  }),
  user: S.Struct({
    id: Id,
    name: S.String,
  }),
};

const crud = <F extends S.Struct.Fields>(b: S.Struct<F>) =>
  S.Struct({
    /**
     * Get a list of items in this collection.
     */
    list: hook(S.partial(b), S.Array(b)),
    get: hook(S.String, b),
    create: hook(S.partial(b), b),
    update: hook(S.partial(b), S.Void),
    delete: hook(S.String, S.Void),
  });

export default S.Struct({
  competitions: crud(schemas.competition),
  users: crud(schemas.user),
  tracks: crud(schemas.track),
});
