import { once } from "es-toolkit";
import {
  makeComponent,
  type Package,
  type PropTypes,
} from "@open-competition-kit/sdk";
import form from "./form";

export default {
  name: "@open-competition-kit/form-json",
  description:
    "Renders configured Open Competition Kit form definitions as JSON Schema forms with React and shadcn components.",
  version: "0.0.6",
  form: { ui: once(async () => makeComponent(form)) },
} satisfies Package;
