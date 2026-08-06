/**
 * The form and field keys this renderer reads, beyond the ones core declares.
 *
 * Core describes a field as an id, a name, a kind and some help text. Whether an
 * answer is required, what a dropdown offers and how tall a text box is belong
 * to the renderer, so they are declared here. Config validation rejects any key
 * no installed package declares, so without this a `required: true` in a config
 * stops the app at boot even though the renderer supports it.
 *
 * `kind` is not declared here. It belongs to core and is an open string, because
 * a package may add a kind of its own: `github:ref-select` is rewritten into a
 * `select` by the GitHub integration's `form.loader` before the renderer sees
 * it. Declaring an enum here would reject that config at boot.
 */
import type { ConfigExtensions } from "@open-competition-kit/sdk";
import { meta, point, value } from "@open-competition-kit/sdk/z";
import { z } from "zod";

/**
 * One choice a `select` offers.
 *
 * The same shape as other points in the config: `id` is stored, `name` is shown.
 * A list of plain strings would store the label, which changes whenever the
 * wording does.
 */
export const option = z.object({ ...point.shape, ...meta.shape });

/**
 * The extra field keys, defined once so that this schema and the renderer's
 * props stay in step. `form.tsx` builds its props from this object.
 */
export const formField = z.object({
  /** Whether the form refuses to submit without an answer. */
  required: z.boolean().optional(),
  /** Placeholder text inside an empty control. */
  placeholder: z.string().optional(),
  /**
   * The choices a `select` offers. A field that names none draws an empty
   * dropdown, which is what you want when a `form.loader` fills them in.
   */
  options: option.array().optional(),
  /** How many rows a `textarea` is tall. Defaults to 5. */
  lines: z.int().positive().optional(),
  /**
   * What the control holds before the user types.
   *
   * A scalar, since that is what a control holds. A file field has no useful
   * default, because its value points at bytes that are uploaded first.
   */
  defaultValue: value.optional(),
});

export const form = z.object({
  /** The text on the submit button. Defaults to "Submit". */
  submitLabel: z.string().optional(),
});

export const config = {
  formField: {
    schema: formField,
    group: { id: "field", label: "Field options" },
    shape: [
      {
        id: "required",
        label: "Required",
        kind: "boolean",
        description: "The form will not submit until this field has an answer.",
      },
      {
        id: "placeholder",
        label: "Placeholder",
        kind: "text",
        description:
          "Shown inside the empty control. Use it for an example answer. Instructions belong in the help text.",
      },
      {
        id: "options",
        label: "Choices",
        kind: "object",
        description:
          "What a select offers, each with an id and a name. The id is stored and the name is shown. Leave it empty if a package supplies the choices, as the GitHub integration does for branches.",
      },
      {
        id: "lines",
        label: "Rows",
        kind: "number",
        description: "How tall a textarea is, in rows. Defaults to 5. Other kinds ignore it.",
      },
      {
        id: "defaultValue",
        label: "Default",
        kind: "text",
        description: "What the control holds before the user types. Leave it empty to start blank.",
      },
    ],
  },
  form: {
    schema: form,
    group: { id: "form", label: "Form options" },
    shape: [
      {
        id: "submitLabel",
        label: "Submit button",
        kind: "text",
        description: 'The text on the button at the bottom of the form. Defaults to "Submit".',
      },
    ],
  },
} satisfies ConfigExtensions;
