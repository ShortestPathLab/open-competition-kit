import { competitions } from "sdk";

const myCompetition = await competitions.list({});

console.log(myCompetition);
