import { withTheme } from "@rjsf/core";
import type { ThemeProps } from "@rjsf/core";

import { templates } from "./templates";
import { widgets } from "./widgets";
import { BaseInputTemplate } from "./widgets";

/**
 * The form's theme, over the same components ui-service renders.
 *
 * Anything not named here falls back to `@rjsf/core`'s own template, which
 * `Form.getRegistry` merges underneath this one. Those cover array and
 * multi-schema chrome that the definitions this package accepts never reach.
 */
export const theme: ThemeProps = {
  templates: { ...templates, BaseInputTemplate },
  widgets,
};

export const Form = withTheme(theme);
