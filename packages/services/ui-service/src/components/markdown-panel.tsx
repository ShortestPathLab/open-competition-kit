import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/panel";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * A panel of prose an organiser wrote.
 *
 * Rules, overviews and briefs are all the same object: a heading and a body of
 * markdown that may not have been written yet, which is why the fallback is a
 * required prop rather than a default. "No rules yet" and "No overview yet" are
 * different sentences and both are better than an empty panel.
 */
export function MarkdownPanel({
  title,
  description,
  markdown,
  fallback,
  proseClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  markdown: string | undefined;
  fallback: string;
  proseClassName?: string;
}) {
  return (
    <Panel>
      <PanelHeader className={description ? "flex-col items-start gap-1" : undefined}>
        <PanelTitle>{title}</PanelTitle>
        {description ? <PanelDescription>{description}</PanelDescription> : null}
      </PanelHeader>
      <PanelBody>
        <div className={cn("prose prose-sm max-w-none dark:prose-invert", proseClassName)}>
          <Markdown remarkPlugins={[remarkGfm]}>{markdown || fallback}</Markdown>
        </div>
      </PanelBody>
    </Panel>
  );
}
