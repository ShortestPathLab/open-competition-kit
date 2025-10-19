import { competitions } from "sdk";

const result = await competitions.list();

if (result.error) throw result.error;

console.log(result.value);
