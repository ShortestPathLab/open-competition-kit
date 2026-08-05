import { FormSkeleton } from "@/components/skeletons";
import { Loader2 } from "lucide-react";
import type { SubmissionCreatorState } from "./use-submission-creator";

type FormPanelProps = Pick<
  SubmissionCreatorState,
  "SubmissionForm" | "formDef" | "formLoading" | "formIsError" | "formError" | "mutation"
> & { trackName: string };

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** The form itself, plus whatever the last attempt to send it had to say. */
export function FormPanel({
  SubmissionForm,
  formDef,
  formLoading,
  formIsError,
  formError,
  mutation,
  trackName,
}: FormPanelProps) {
  return (
    <div className="space-y-4">
      {formLoading ? <FormSkeleton fields={4} /> : null}

      {formIsError ? (
        <p className="text-sm font-medium text-destructive">
          {messageOf(formError, "Submission form failed to load.")}
        </p>
      ) : null}

      {formDef ? (
        <SubmissionForm
          def={formDef}
          onSubmit={async (values) => {
            await mutation.mutateAsync(values);
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {mutation.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating submission.
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {mutation.isPending
            ? "Submission will be created shortly."
            : `Submission will be created for ${trackName}.`}
        </p>
      </div>

      {mutation.isError ? (
        <p className="text-sm font-medium text-destructive">
          {messageOf(mutation.error, "Submission failed.")}
        </p>
      ) : null}

      {mutation.isSuccess ? (
        <p className="text-sm text-muted-foreground">Submission created for {trackName}.</p>
      ) : null}
    </div>
  );
}
