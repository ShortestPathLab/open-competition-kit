import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/panel";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { ReactNode } from "react";

/**
 * A panel showing the first few of something, with a way to the rest.
 *
 * Both halves of this page are the same object: a heading, an escape hatch to
 * the full list, and either a handful of rows or a reason there are none.
 */
export function PreviewPanel({
  title,
  seeAll,
  children,
}: {
  title: string;
  seeAll: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        {seeAll}
      </PanelHeader>
      <PanelBody>{children}</PanelBody>
    </Panel>
  );
}

export function PanelEmpty({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Empty className="rounded-xl border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
