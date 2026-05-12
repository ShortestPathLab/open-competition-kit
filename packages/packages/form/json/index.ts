import { once } from "es-toolkit";
import { makeComponent, type Package, type PropTypes } from "sdk";
import form from "./form";

export default {
  form: { ui: once(async () => makeComponent(form)) },
} satisfies Package;
