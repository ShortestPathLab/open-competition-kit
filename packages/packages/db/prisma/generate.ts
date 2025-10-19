import { defer } from "lodash-es";
import { db } from "./db";

defer(db);
