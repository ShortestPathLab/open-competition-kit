import React from "react";
import { SchemaExamples } from "@rjsf/core";
import {
  ariaDescribedByIds,
  descriptionId,
  enumOptionSelectedValue,
  enumOptionValueDecoder,
  enumOptionValueEncoder,
  examplesId,
  getInputProps,
  getOptionValueFormat,
  labelValue,
  schemaRequiresTrueValue,
} from "@rjsf/utils";
import type { BaseInputTemplateProps, WidgetProps } from "@rjsf/utils";

import { Checkbox } from "../ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";

/** Backs every `<input>`-shaped widget: text, email, number, url and the rest. */
export function BaseInputTemplate({
  id,
  htmlName,
  placeholder,
  required,
  readonly,
  disabled,
  type,
  value,
  onChange,
  onChangeOverride,
  onBlur,
  onFocus,
  autofocus,
  options,
  schema,
  rawErrors = [],
  children,
  extraProps,
  className,
  registry,
}: BaseInputTemplateProps) {
  const { ClearButton } = registry.templates.ButtonTemplates;
  const inputProps = { ...extraProps, ...getInputProps(schema, type, options) };

  const handleChange = ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) =>
    onChange(value === "" ? options.emptyValue : value);
  const handleBlur = ({ target }: React.FocusEvent<HTMLInputElement>) =>
    onBlur(id, target && target.value);
  const handleFocus = ({ target }: React.FocusEvent<HTMLInputElement>) =>
    onFocus(id, target && target.value);
  const handleClear = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onChange(options.emptyValue ?? "");
    },
    [onChange, options.emptyValue],
  );

  const clearable = options.allowClearTextInputs && !readonly && !disabled && value;

  return (
    <div className={cn(clearable && "relative")}>
      <Input
        id={id}
        name={htmlName || id}
        type={type}
        placeholder={placeholder}
        autoFocus={autofocus}
        required={required}
        disabled={disabled}
        readOnly={readonly}
        className={className}
        aria-invalid={rawErrors.length > 0 || undefined}
        list={schema.examples ? examplesId(id) : undefined}
        {...inputProps}
        value={value || value === 0 ? value : ""}
        onChange={onChangeOverride || handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        aria-describedby={ariaDescribedByIds(id, !!schema.examples)}
      />
      {clearable ? <ClearButton onClick={handleClear} registry={registry} /> : null}
      {children}
      <SchemaExamples id={id} schema={schema} />
    </div>
  );
}

export function TextareaWidget({
  id,
  htmlName,
  placeholder,
  value,
  required,
  disabled,
  autofocus,
  readonly,
  onBlur,
  onFocus,
  onChange,
  options,
  rawErrors = [],
  className,
}: WidgetProps) {
  const handleChange = ({ target: { value } }: React.ChangeEvent<HTMLTextAreaElement>) =>
    onChange(value === "" ? options.emptyValue : value);
  const handleBlur = ({ target }: React.FocusEvent<HTMLTextAreaElement>) =>
    onBlur(id, target && target.value);
  const handleFocus = ({ target }: React.FocusEvent<HTMLTextAreaElement>) =>
    onFocus(id, target && target.value);

  return (
    <Textarea
      id={id}
      name={htmlName || id}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readonly}
      value={value ?? ""}
      required={required}
      autoFocus={autofocus}
      rows={typeof options.rows === "number" ? options.rows : 5}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      aria-invalid={rawErrors.length > 0 || undefined}
      aria-describedby={ariaDescribedByIds(id)}
      className={className}
    />
  );
}

/**
 * A dropdown, over the same Base UI `Select` the app uses.
 *
 * Single selection only. The definitions this package accepts describe a field
 * as one of a closed list of kinds, none of which produce an array of enums, so
 * `multiple` never arrives. If that list ever grows a multi-select kind, this
 * needs the array branch.
 */
export function SelectWidget({
  id,
  htmlName,
  options,
  required,
  disabled,
  readonly,
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder,
  rawErrors = [],
  className,
}: WidgetProps) {
  const { enumOptions, enumDisabled, emptyValue } = options;
  const format = getOptionValueFormat(options);

  const items = (enumOptions ?? []).map((option, index) => ({
    value: enumOptionValueEncoder(option.value, index, format),
    label: option.label,
    disabled: Array.isArray(enumDisabled) && enumDisabled.includes(option.value),
  }));

  const selected = enumOptionSelectedValue(value, enumOptions, false, format, "") as string;

  return (
    <Select
      items={items}
      name={htmlName || id}
      value={selected === "" ? null : selected}
      disabled={disabled || readonly}
      required={required}
      onValueChange={(next) =>
        onChange(enumOptionValueDecoder(next ?? "", enumOptions, format, emptyValue))
      }
    >
      <SelectTrigger
        id={id}
        className={cn("w-full", className)}
        aria-invalid={rawErrors.length > 0 || undefined}
        aria-describedby={ariaDescribedByIds(id)}
        onBlur={() => onBlur(id, value)}
        onFocus={() => onFocus(id, value)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CheckboxWidget({
  id,
  htmlName,
  value,
  disabled,
  readonly,
  label,
  hideLabel,
  schema,
  autofocus,
  options,
  onChange,
  onBlur,
  onFocus,
  rawErrors = [],
  className,
}: WidgetProps) {
  // An unchecked box fails HTML5 validation, so `required` only goes on when
  // the schema genuinely demands `true` via `const` or `enum`.
  const required = schemaRequiresTrueValue(schema);
  const description = options.description || schema.description;
  const text = labelValue(label, hideLabel || !label);

  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        name={htmlName || id}
        checked={typeof value === "undefined" ? false : Boolean(value)}
        required={required}
        disabled={disabled || readonly}
        autoFocus={autofocus}
        onCheckedChange={(checked) => onChange(checked)}
        onBlur={() => onBlur(id, value)}
        onFocus={() => onFocus(id, value)}
        aria-invalid={rawErrors.length > 0 || undefined}
        aria-describedby={ariaDescribedByIds(id)}
        className={className}
      />
      {text || description ? (
        <FieldContent>
          {text ? <FieldLabel htmlFor={id}>{text}</FieldLabel> : null}
          {description ? (
            <FieldDescription id={descriptionId(id)}>{description}</FieldDescription>
          ) : null}
        </FieldContent>
      ) : null}
    </Field>
  );
}

export const widgets = {
  CheckboxWidget,
  SelectWidget,
  TextareaWidget,
};
