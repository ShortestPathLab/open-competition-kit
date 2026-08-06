import type { RegistryFieldsType, RJSFSchema, UiSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import React from "react";
import type { $props, ComponentDef } from "@open-competition-kit/sdk";
import { meta, shape } from "@open-competition-kit/sdk/z";
import { z } from "zod";
import { form as formConfig, formField } from "./config";
import { FileField } from "./file-field";
import { Form } from "./rjsf/theme";
import { css } from "./theme/css";
import { useHostDarkMode } from "@open-competition-kit/sdk/theme";
import { PortalContainerProvider } from "./ui/portal";

// Form values are serialisable, not merely scalar: a file field's value is a
// `FileRef` object, and the submission body is JSON regardless.
const json: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(json),
    z.record(z.string(), json),
  ]),
);

/**
 * What this renderer is handed: the keys a config can set, plus the ones only a
 * caller can supply.
 *
 * The extra field keys are imported from `./config` rather than repeated here.
 * That module declares them to config validation, so defining them twice would
 * let the two disagree about which keys a config may use.
 */
const propsSchema = z.object({
  ...meta.shape,
  ...formConfig.shape,
  shape: z
    .object({
      ...shape.shape,
      ...meta.shape,
      ...formField.shape,
      kind: z
        .enum(["text", "email", "number", "textarea", "select", "checkbox", "file"])
        .optional(),
    })
    .array(),
  /**
   * Values to open the form with, keyed by field id.
   *
   * Not a config key. A `file` entry here is a `FileRef` pointing at uploaded
   * bytes, which a `form.loader` can supply and a config file cannot. Use
   * `defaultValue` on a field to set a starting value from config.
   */
  initialData: z.record(z.string(), json).optional(),
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
      } else if (shapeItem.kind === "file") {
        // The value is a FileRef, so the property is an object. RJSF renders
        // objects with a Field rather than a Widget — hence `ui:field` below.
        property.type = "object";
        property.additionalProperties = true;
      } else {
        property.type = "string";
      }

      if (shapeItem.kind === "email") {
        property.format = "email";
      }

      if (shapeItem.kind === "select" && shapeItem.options?.length) {
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

  const schema: RJSFSchema = {
    title: props.label ?? "Submission Options",
    type: "object",
    required: props.shape
      .filter((shapeItem) => shapeItem.required)
      .map((shapeItem) => shapeItem.id),
    properties,
  };

  if (props.description) {
    schema.description = props.description;
  }

  return schema;
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

      if (shapeItem.kind === "file") {
        config["ui:field"] = "file";
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

const fields: RegistryFieldsType = { file: FileField };

export function JsonForm({ onSubmit, def }: typeof $props.form.ui) {
  const result = z.safeParse(propsSchema as z.ZodType<FormDef>, def);
  if (!result.success)
    throw new Error(
      `Error: ${z.prettifyError(result.error)}\nReceived: ${JSON.stringify(def, null, 2)}`,
    );

  const portalContainer = React.useRef<HTMLDivElement>(null);
  const isDark = useHostDarkMode();

  const schema = buildSchema(result.data);
  const uiSchema = buildUiSchema(result.data);
  const formData = buildFormData(result.data);

  return (
    <div className={isDark ? "dark" : undefined}>
      {/* A kit component mounts inside a shadow root with no stylesheet of its
          own, so the form carries one. A plain <style> with no `precedence` is
          the one shape React 19 renders where it is written rather than
          hoisting into the document head, where it could not reach in here. */}
      <style>{css}</style>
      <PortalContainerProvider value={portalContainer}>
        <Form
          schema={schema}
          uiSchema={uiSchema}
          formData={formData}
          fields={fields}
          validator={validator}
          onSubmit={({ formData }) => {
            onSubmit?.(formData);
          }}
        />
      </PortalContainerProvider>
      <div ref={portalContainer} />
    </div>
  );
}

export default {
  component: JsonForm,
  path: import.meta.path,
} satisfies ComponentDef<typeof $props.form.ui>;
