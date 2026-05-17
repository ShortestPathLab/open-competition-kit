import Form from "@rjsf/shadcn";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import React from "react";
import type { $props, ComponentDef } from "@open-competition-kit/sdk";
import { meta, point, shape, value } from "@open-competition-kit/sdk/z";
import { z } from "zod";

const propsSchema = z.object({
  ...meta.shape,
  shape: z
    .object({
      ...shape.shape,
      ...meta.shape,
      kind: z
        .enum(["text", "email", "number", "textarea", "select", "checkbox"])
        .optional(),
      placeholder: z.string().optional(),
      /**
       * Options for multiple-choice fields.
       */
      options: z
        .object({ ...point.shape, ...meta.shape })
        .array()
        .optional(),
      /**
       * Line count for textareas.
       */
      lines: z.number().optional(),
      defaultValue: value.optional(),
      required: z.boolean().optional(),
    })
    .array(),
  initialData: z.record(z.string(), value).optional(),
  submitLabel: z.string().optional(),
}) satisfies z.ZodType<(typeof $props.form.ui)["def"]>;

type FormDef = z.infer<typeof propsSchema> & (typeof $props.form.ui)["def"];

function buildSchema(props: FormDef): RJSFSchema {
  const properties = Object.fromEntries(
    props.shape.map((shapeItem) => {
      const property: RJSFSchema = { title: shapeItem.name ?? shapeItem.id };

      if (shapeItem.description) {
        property.description = shapeItem.description;
      }

      if (shapeItem.kind === "checkbox") {
        property.type = "boolean";
      } else if (shapeItem.kind === "number") {
        property.type = "number";
      } else {
        property.type = "string";
      }

      if (shapeItem.kind === "email") {
        property.format = "email";
      }

      if (shapeItem.kind === "select" && shapeItem.options?.length) {
        property.type === "string";
        property.oneOf = shapeItem.options.map((option) => ({
          const: option.value ?? option.id,
          title: option.name ?? option.id,
        }));
      }

      if (shapeItem.defaultValue !== undefined) {
        property.default = shapeItem.defaultValue;
      }

      return [shapeItem.id, property];
    }),
  );

  return {
    title: props.label ?? "Submission Options",
    description: props.description ?? "",
    type: "object",
    required: props.shape
      .filter((shapeItem) => shapeItem.required)
      .map((shapeItem) => shapeItem.id),
    properties,
  };
}

function buildUiSchema(props: FormDef): UiSchema {
  const shapeUiSchema = Object.fromEntries(
    props.shape.map((shapeItem) => {
      const config: Record<string, unknown> = {};

      if (shapeItem.placeholder) {
        config["ui:placeholder"] = shapeItem.placeholder;
      }

      if (shapeItem.kind === "textarea") {
        config["ui:widget"] = "textarea";
        config["ui:options"] = { rows: shapeItem.lines ?? 5 };
      }

      return [shapeItem.id, config];
    }),
  );

  return {
    ...shapeUiSchema,
    "ui:submitButtonOptions": { submitText: props.submitLabel ?? "Submit" },
  };
}

function buildFormData(props: FormDef) {
  return {
    ...Object.fromEntries(
      props.shape
        .filter((shapeItem) => shapeItem.defaultValue !== undefined)
        .map((shapeItem) => [shapeItem.id, shapeItem.defaultValue]),
    ),
    ...props.initialData,
  };
}

export function JsonForm({ onSubmit, def }: typeof $props.form.ui) {
  const result = z.safeParse(propsSchema as z.ZodType<FormDef>, def);
  if (!result.success)
    throw new Error(
      `Error: ${z.prettifyError(result.error)}\nReceived: ${JSON.stringify(def, null, 2)}`,
    );
  const schema = buildSchema(result.data);
  const uiSchema = buildUiSchema(result.data);
  const formData = buildFormData(result.data);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@rjsf/shadcn@6.5.2/dist/default.css"
      />
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.2.4/dist/index.global.min.js" />
      <div>
        <div>
          <h2 className="m-0 text-2xl font-semibold tracking-tight text-stone-950">
            {result.data.label}
          </h2>
          <p className="mt-2 text-stone-600">{propsSchema.description}</p>
        </div>

        <div>
          <Form
            schema={schema}
            uiSchema={uiSchema}
            formData={formData}
            validator={validator}
            onSubmit={({ formData }) => {
              onSubmit?.(formData);
            }}
          />
        </div>
      </div>
    </>
  );
}

export default {
  component: JsonForm,
  path: import.meta.path,
} satisfies ComponentDef<typeof $props.form.ui>;
