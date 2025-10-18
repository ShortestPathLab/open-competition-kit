import { Context as C, Layer as L } from "effect";

export class Database extends C.Tag("Database")<
  Database,
  {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
  }
>() {}

export const DatabaseContext = L.succeed(Database, {
  connect: async () => {},
  disconnect: async () => {},
});
