import { competitions } from "sdk";

const result = await competitions.create({ name: "1" });
console.log(result.value, result.error);

const myCompetition = await competitions.list({});

console.log(myCompetition);
