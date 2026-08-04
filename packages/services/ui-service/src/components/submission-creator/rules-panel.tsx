import { MarkdownPanel } from "@/components/markdown-panel";
import type { TrackSummary } from "@/lib/competition-data";

/** The rail beside the form: the selected track's rules, as published. */
export function RulesPanel({ track }: { track: TrackSummary | undefined }) {
  return (
    <MarkdownPanel
      title={track?.name ?? "Rules"}
      description={track?.description ?? "Select a track to review its rules."}
      markdown={track?.rules}
      fallback="No rules have been published for this track yet."
    />
  );
}
