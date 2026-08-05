import { write } from "bun";
import { Match as M, Schema as S } from "effect";
import { capitalize } from "es-toolkit";
import { hook } from "@open-competition-kit/sdk";

const { schemas, Id, Number, Boolean, Date, String, Int, Json, CreatedAt } = hook.db;

const is =
  <T>(a: T) =>
  (b: unknown): b is T =>
    a === b;

function one(name: string, s: (typeof schemas)[keyof typeof schemas]) {
  const lines = Object.entries(s.fields)
    .map(([k, v]) => {
      const type = M.value(v as S.SchemaClass<string, string, never>).pipe(
        M.when(is(Id), () => "String @id @default(cuid())"),
        M.when(is(CreatedAt), () => "DateTime @default(now())"),
        M.when(is(String), () => 'String @default("")'),
        M.when(is(Number), () => "Float @default(0.0)"),
        M.when(is(Int), () => "Int @default(0)"),
        M.when(is(Boolean), () => "Boolean @default(false)"),
        M.when(is(Date), () => "DateTime"),
        M.when(is(Json), () => 'Json @default("null")'),
        M.orElse(() => ""),
      );
      return type ? `${k} ${type}` : "";
    })
    .filter((a) => !!a);
  return clause(`model ${capitalize(name)}`, lines);
}

type Config = { datasource: { provider: string } };

function clause(s: string, b: string[]) {
  return `${s} {\n${b.join("\n")}\n}`;
}

export async function toPrisma(db: Config) {
  const a1 = [
    clause(
      "datasource db",
      Object.entries(db.datasource).map(([k, v]) => `${k} = "${v}"`),
    ),
    clause("generator client", [
      'provider = "prisma-client"',
      `output = "${import.meta.dir}/generated"`,
    ]),
    ...Object.entries(schemas).map(([k, v]) => one(k, v)),
  ];
  await write(`${import.meta.dir}/schemas/schema.prisma`, a1.join("\n\n"));
}
