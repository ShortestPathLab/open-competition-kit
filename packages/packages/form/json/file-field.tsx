import type { FieldProps } from "@rjsf/utils";
// From core/file, not the sdk barrel. This file is bundled for a browser, and
// the barrel reaches Bun's shell, Effect's node platform and youch — none of
// which esbuild can resolve without a Node platform, so the bundle fails and
// takes the whole form loader down with it. Import the leaf that holds `isFile`.
import { isFile, type FileRef } from "@open-competition-kit/core/file";
import React from "react";
import { upload, type UploadProgress } from "./upload";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "./ui/field";
import { Input } from "./ui/input";

const format = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

/**
 * A file upload field.
 *
 * This is an RJSF *field* rather than a widget: a widget's value is a scalar, and
 * this one's value is a `FileRef` object — the pointer that goes in the database
 * where the bytes used to.
 *
 * The bytes never pass through the form's submit. They are uploaded when picked,
 * and the form carries only the reference.
 */
export function FileField(props: FieldProps) {
  const { formData, onChange, path, schema, required, idSchema } = props;

  const [progress, setProgress] = React.useState<UploadProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const current: FileRef | undefined = isFile(formData) ? formData : undefined;
  const id = idSchema?.$id ?? "file";

  const pick = async (file: File | undefined) => {
    if (!file) return;

    setError(null);
    setProgress({ loaded: 0, total: file.size });

    try {
      const ref = await upload(file, setProgress);
      onChange(ref, path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      onChange(undefined, path);
    } finally {
      setProgress(null);
    }
  };

  const percent =
    progress && progress.total > 0 ?
      Math.round((progress.loaded / progress.total) * 100)
    : 0;

  return (
    <Field data-invalid={error ? "true" : undefined}>
      <FieldLabel htmlFor={id}>
        {schema.title}
        {required ?
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        : null}
      </FieldLabel>

      <Input
        className="h-auto py-1.5 file:mr-2.5 file:rounded-md file:bg-secondary file:px-2 file:py-0.5 file:text-secondary-foreground"
        disabled={!!progress}
        id={id}
        onChange={(e) => void pick(e.currentTarget.files?.[0])}
        type="file"
      />

      {progress ?
        <div className="flex flex-col gap-1.5">
          <div
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <FieldDescription>
            Uploading… {percent}% ({format(progress.loaded)} of{" "}
            {format(progress.total)})
          </FieldDescription>
        </div>
      : null}

      {current && !progress ?
        <FieldDescription>
          <span className="font-medium text-foreground">
            {current.name ?? "File"}
          </span>{" "}
          ({format(current.size)}) uploaded
        </FieldDescription>
      : null}

      {schema.description ?
        <FieldDescription>{schema.description}</FieldDescription>
      : null}

      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
