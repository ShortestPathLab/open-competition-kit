import { MarkdownPanel } from "@/components/markdown-panel";

/** The organiser's own words about the competition. */
export function AboutPanel({ overview }: { overview: string }) {
  return (
    <MarkdownPanel
      title="About this competition"
      markdown={overview}
      fallback="No overview has been published yet."
      // An overview usually opens with its own heading, which would otherwise
      // sit under the panel's title at twice its size.
      proseClassName="[&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-base"
    />
  );
}
