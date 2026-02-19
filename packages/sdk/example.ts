import { competitions, } from "sdk";

const myCompetition = await competitions.

competitions.on(
    'change',
    ()=>{
        
    }
)

const result = await competitions.list();

if (result.error) throw result.error;

console.log(result.value);
