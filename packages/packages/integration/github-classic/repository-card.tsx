import React from "react";
import type { ComponentDef, SurfaceViewProps } from "@open-competition-kit/sdk";

/**
 * The participant's repository, with the branches they can submit.
 *
 * A component rather than a note because a note cannot hold this: the branch
 * list is live, it grows every time they push, and every row is its own link. A
 * `fact` would flatten it to one line and a `note` to a paragraph of markdown
 * with no per-branch links in it.
 *
 * Styled with the host's own custom properties. Those inherit across a shadow
 * boundary, so a renderer that reads them tracks the app's light and dark themes
 * without carrying a second palette that has to be kept in step with the first.
 * The fallbacks are only for a host that sets no tokens at all.
 */
export type RepositoryCardProps = {
  owner: string;
  repo: string;
  url: string;
  branches: { name: string; sha: string }[];
};

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    color: "var(--foreground, #0e1220)",
    fontSize: "0.875rem",
    lineHeight: 1.45,
  },
  path: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: "0.8125rem",
    wordBreak: "break-all",
  },
  hint: { color: "var(--muted-foreground, #4c5468)", fontSize: "0.8125rem" },
  list: {
    display: "flex",
    flexDirection: "column",
    border: "1px solid var(--border, #e5e8f0)",
    borderRadius: "calc(var(--radius, 0.625rem) - 2px)",
    overflow: "hidden",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.5rem 0.75rem",
    color: "inherit",
    textDecoration: "none",
    borderTop: "1px solid var(--border, #e5e8f0)",
  },
  name: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: "0.8125rem",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sha: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: "0.75rem",
    color: "var(--muted-foreground, #4c5468)",
    flexShrink: 0,
  },
  link: {
    color: "var(--primary, #4f46e5)",
    fontWeight: 500,
    textDecoration: "none",
  },
} satisfies Record<string, React.CSSProperties>;

export function RepositoryCard({
  props,
}: SurfaceViewProps<RepositoryCardProps>) {
  const { owner, repo, url, branches } = props;

  return (
    <div style={styles.root}>
      <div>
        <div style={styles.path}>
          {owner}/{repo}
        </div>
        <div style={styles.hint}>
          You have push access. Commit your work to a branch, then choose that
          branch when you submit.
        </div>
      </div>

      {branches.length > 0 ?
        <div style={styles.list}>
          {branches.map((branch, index) => (
            <a
              key={branch.name}
              href={`${url}/tree/${encodeURIComponent(branch.name)}`}
              target="_blank"
              rel="noreferrer noopener"
              // The first row keeps the container's own top border rather than
              // drawing a second one over it.
              style={{ ...styles.row, borderTop: index === 0 ? "none" : styles.row.borderTop }}
            >
              <span style={styles.name}>{branch.name}</span>
              <span style={styles.sha}>{branch.sha.slice(0, 7)}</span>
            </a>
          ))}
        </div>
      : <div style={styles.hint}>
          Nothing pushed yet. Your first commit will show up here.
        </div>
      }

      <a
        style={styles.link}
        href={url}
        target="_blank"
        rel="noreferrer noopener"
      >
        Open on GitHub
      </a>
    </div>
  );
}

export default {
  component: RepositoryCard,
  path: import.meta.path,
} satisfies ComponentDef<SurfaceViewProps<RepositoryCardProps>>;
