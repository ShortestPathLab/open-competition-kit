import React from "react";
import { RichDescription } from "@rjsf/core";
import {
  buttonId,
  canExpand,
  descriptionId,
  errorId,
  getSubmitButtonOptions,
  getTemplate,
  getUiOptions,
  titleId,
  TranslatableString,
} from "@rjsf/utils";
import type {
  DescriptionFieldProps,
  ErrorListProps,
  FieldErrorProps,
  FieldTemplateProps,
  IconButtonProps,
  ObjectFieldTemplateProps,
  SubmitButtonProps,
  TitleFieldProps,
} from "@rjsf/utils";

import { Button } from "../ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../ui/field";
import { cn } from "../ui/utils";

/**
 * One labelled control.
 *
 * Order follows the shadcn `Field` composition — label, control, description,
 * error — because `FieldDescription` and `FieldError` carry margin rules keyed
 * off their position among their siblings, and reordering them silently
 * changes the spacing.
 *
 * A checkbox gets no label here. `getDisplayLabel` returns false for a boolean
 * with no explicit `ui:widget`, and `CheckboxWidget` lays out its own label
 * beside the box.
 */
export function FieldTemplate({
  id,
  children,
  classNames,
  style,
  label,
  displayLabel,
  description,
  rawDescription,
  rawErrors = [],
  errors,
  help,
  hidden,
  required,
  disabled,
}: FieldTemplateProps) {
  if (hidden) {
    return <div className="hidden">{children}</div>;
  }

  const invalid = rawErrors.length > 0;

  return (
    <Field
      className={classNames}
      style={style}
      data-invalid={invalid ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
    >
      {displayLabel && label ?
        <FieldLabel htmlFor={id}>
          {label}
          {required ?
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          : null}
        </FieldLabel>
      : null}
      {children}
      {displayLabel && rawDescription ? description : null}
      {errors}
      {help}
    </Field>
  );
}

/** An object's title, description and properties, as a fieldset. */
export function ObjectFieldTemplate({
  title,
  description,
  properties,
  required,
  schema,
  uiSchema,
  formData,
  fieldPathId,
  optionalDataControl,
  onAddProperty,
  disabled,
  readonly,
  registry,
}: ObjectFieldTemplateProps) {
  const uiOptions = getUiOptions(uiSchema);
  const TitleFieldTemplate = getTemplate("TitleFieldTemplate", registry, uiOptions);
  const DescriptionFieldTemplate = getTemplate(
    "DescriptionFieldTemplate",
    registry,
    uiOptions,
  );
  const {
    ButtonTemplates: { AddButton },
  } = registry.templates;

  return (
    <FieldSet>
      {title ?
        <TitleFieldTemplate
          id={titleId(fieldPathId)}
          title={title}
          required={required}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
          optionalDataControl={
            !readonly && !disabled ? optionalDataControl : undefined
          }
        />
      : null}
      {description ?
        <DescriptionFieldTemplate
          id={descriptionId(fieldPathId)}
          description={description}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
        />
      : null}
      <FieldGroup>
        {/* `FieldTemplate` hides a hidden property itself, so this can render
            every one of them the same way. */}
        {properties.map((element, index) => (
          <React.Fragment key={index}>{element.content}</React.Fragment>
        ))}
        {canExpand(schema, uiSchema, formData) ?
          <div className="flex">
            <AddButton
              id={buttonId(fieldPathId, "add")}
              className="rjsf-object-property-expand"
              onClick={onAddProperty}
              disabled={disabled || readonly}
              uiSchema={uiSchema}
              registry={registry}
            />
          </div>
        : null}
      </FieldGroup>
    </FieldSet>
  );
}

/**
 * Renders a `<legend>`, which is only valid as the first child of a fieldset.
 * `ObjectFieldTemplate` is the one caller that puts it there, and the schemas
 * this package builds are flat objects, so there is no other path to it.
 */
export function TitleFieldTemplate({
  id,
  title,
  uiSchema,
  optionalDataControl,
}: TitleFieldProps) {
  const uiOptions = getUiOptions(uiSchema);
  const text = uiOptions.title || title;

  if (!text) {
    return null;
  }

  if (optionalDataControl) {
    return (
      <FieldLegend id={id} className="flex items-center justify-between gap-2">
        <span>{text}</span>
        {optionalDataControl}
      </FieldLegend>
    );
  }

  return <FieldLegend id={id}>{text}</FieldLegend>;
}

export function DescriptionFieldTemplate({
  id,
  description,
  registry,
  uiSchema,
}: DescriptionFieldProps) {
  if (!description) {
    return null;
  }

  return (
    <FieldDescription id={id}>
      <RichDescription
        description={description}
        registry={registry}
        uiSchema={uiSchema}
      />
    </FieldDescription>
  );
}

export function FieldErrorTemplate({ errors = [], fieldPathId }: FieldErrorProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <FieldError id={errorId(fieldPathId)}>
      {errors.length === 1 ?
        errors[0]
      : <ul className="ml-4 flex list-disc flex-col gap-1">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      }
    </FieldError>
  );
}

/** The summary of every error in the form, rendered above it. */
export function ErrorListTemplate({ errors, registry }: ErrorListProps) {
  const { translateString } = registry;

  return (
    <div
      role="alert"
      className="mb-5 flex flex-col gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <p className="font-medium">
        {translateString(TranslatableString.ErrorsLabel)}
      </p>
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {errors.map((error, index) => (
          <li key={index}>{error.stack}</li>
        ))}
      </ul>
    </div>
  );
}

export function SubmitButton(props: SubmitButtonProps) {
  const {
    submitText,
    norender,
    props: submitButtonProps,
  } = getSubmitButtonOptions(props.uiSchema);

  if (norender) {
    return null;
  }

  return (
    <div className="mt-5 flex">
      <Button type="submit" {...submitButtonProps}>
        {submitText}
      </Button>
    </div>
  );
}

/** Clears a text input. Off unless `ui:options.allowClearTextInputs` is set. */
export function ClearButton({
  className,
  registry,
  ...props
}: IconButtonProps) {
  const { translateString } = registry;
  const label = translateString(TranslatableString.ClearLabel);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className={cn("absolute top-1 right-1", className)}
      {...props}
    >
      <span aria-hidden="true">&times;</span>
    </Button>
  );
}

export const templates = {
  FieldTemplate,
  ObjectFieldTemplate,
  TitleFieldTemplate,
  DescriptionFieldTemplate,
  FieldErrorTemplate,
  ErrorListTemplate,
  ButtonTemplates: { SubmitButton, ClearButton },
};
