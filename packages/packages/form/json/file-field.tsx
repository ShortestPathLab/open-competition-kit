import type { FieldProps } from "@rjsf/utils";
import { isFile, type FileRef } from "@open-competition-kit/sdk";
import React from "react";
import { upload, type UploadProgress } from "./upload";

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
    <div className="mb-4">
      <label
        className="mb-1 block text-sm font-medium text-stone-900"
        htmlFor={id}
      >
        {schema.title}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>

      {schema.description ?
        <p className="mb-2 text-sm text-stone-600">{schema.description}</p>
      : null}

      <input
        className="block w-full rounded-md border border-stone-300 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm"
        disabled={!!progress}
        id={id}
        onChange={(e) => void pick(e.currentTarget.files?.[0])}
        type="file"
      />

      {progress ?
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-stone-900 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-stone-600">
            Uploading… {percent}% ({format(progress.loaded)} of{" "}
            {format(progress.total)})
          </p>
        </div>
      : null}

      {current && !progress ?
        <p className="mt-2 text-sm text-stone-700">
          <span className="font-medium">{current.name ?? "File"}</span>{" "}
          <span className="text-stone-500">({format(current.size)})</span>{" "}
          <span className="text-green-700">uploaded</span>
        </p>
      : null}

      {error ?
        <p className="mt-2 text-sm text-red-600">{error}</p>
      : null}
    </div>
  );
}
