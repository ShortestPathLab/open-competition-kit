import { lazyComponent, type Package } from "@open-competition-kit/sdk";
import { config } from "./config";
import form from "./form";

export * from "./config";

export default {
  name: "@open-competition-kit/form-json",
  description:
    "Renders configured Open Competition Kit form definitions as JSON Schema forms with React and shadcn components.",
  version: "0.0.11",
  config,
  form: { ui: lazyComponent(form) },
} satisfies Package;
