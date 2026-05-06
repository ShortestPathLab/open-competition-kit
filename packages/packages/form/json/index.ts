import { once } from "es-toolkit";
import { makeComponent, type Package } from "sdk";
import form from "./form";

export default {
  form: { ui: once(async () => makeComponent(form)) },
} satisfies Package;
