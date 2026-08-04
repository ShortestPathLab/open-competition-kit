import {
  BookOpen,
  Download,
  ExternalLink,
  GitBranch,
  Github,
  Info,
  Terminal,
  Upload,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon names a contribution may ask for.
 *
 * An unknown name draws nothing, so a package can name an icon a newer host has
 * without an older one rendering a broken box where the glyph goes.
 */
export const ICONS: Record<string, LucideIcon> = {
  github: Github,
  external: ExternalLink,
  book: BookOpen,
  branch: GitBranch,
  terminal: Terminal,
  upload: Upload,
  download: Download,
  info: Info,
};

export const NOTE_TONES = {
  info: "border-border bg-muted/40",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  danger: "border-destructive/30 bg-destructive/5",
} as const;

export const NOTE_TITLE_TONES = {
  info: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
} as const;

export const STEP_DOTS = {
  ok: "bg-success",
  pending: "bg-warning",
  blocked: "bg-destructive",
} as const;

export const BUTTON_VARIANTS = {
  primary: "default",
  secondary: "outline",
  link: "link",
} as const;
