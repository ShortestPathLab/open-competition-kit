import { write } from "bun";
import { Match as M, Schema as S, SchemaAST } from "effect";
import { capitalize, entries } from "lodash-es";
import { hook } from "sdk";

const { schemas, Id, Number, Boolean, Date, String, Int, Literal } = hook.db;

const is =
  <T>(a: T) =>
  (b: unknown): b is T =>
    a === b;

function one(name: string, s: (typeof schemas)[keyof typeof schemas]) {
  const lines = entries(s.fields)
    .map(([k, v]) => {
      console.log(k, v);
      const type = M.value(v as S.SchemaClass<string, string, never>).pipe(
        M.when(is(Id), () => "String @id @default(cuid())"),
        M.when(is(String), () => "String"),
        M.when(is(Number), () => "Float"),
        M.when(is(Int), () => "Int"),
        M.when(is(Boolean), () => "Boolean"),
        M.when(is(Date), () => "DateTime"),
        M.when(isLiteral, (l) => console.log("test", l.literal)),
        M.orElse(() => "")
      );
      return type ? `${k} ${type}` : "";
    })
    .filter((a) => !!a);
  return clause(`model ${capitalize(name)}`, lines);
}

type Config = {
  datasource: {
    provider: string;
  };
};

function clause(s: string, b: string[]) {
  return `${s} {\n${b.join("\n")}\n}`;
}

export async function toPrisma(db: Config) {
  const a1 = [
    clause(
      "datasource db",
      entries(db.datasource).map(([k, v]) => `${k} = "${v}"`)
    ),
    clause("generator client", [
      'provider = "prisma-client"',
      `output = "${import.meta.dir}/generated"`,
    ]),
    ...entries(schemas).map(([k, v]) => one(k, v)),
  ];
  await write(`${import.meta.dir}/schemas/schema.prisma`, a1.join("\n\n"));
}
