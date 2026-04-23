import { competitions,tracks } from ".";

const result = await competitions.create({ name: "Test competition" });
console.log(result.value, result.error);

const myCompetition = await competitions.list({});
const myTracks = await tracks.of(myCompetition.);
console.log(myCompetition);
