import { Badge } from "@/components/ui/badge";
import { CompetitionIcon } from "@/components/entity-icon";
import { Link } from "@tanstack/react-router";
import { PencilRuler } from "lucide-react";

interface CompetitionCardProps {
  id: string;
  name: string;
  organiser: string;
  trackCount?: number;
  /** The organiser's picture for this competition, when they configured one. */
  icon?: string;
  /** Drafts only ever reach an organiser, so the marker is for their benefit. */
  isDraft?: boolean;
}

export function CompetitionCard({
  id,
  name,
  organiser,
  trackCount,
  icon,
  isDraft,
}: CompetitionCardProps) {
  return (
    <Link
      to="/competitions/$id"
      params={{ id }}
      className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-ring"
    >
      {/* The only slot here that is not square, and the only one that contains
          rather than covers. Cropping a square logo to 4:3 takes a bite out of
          its top and bottom; letterboxed against the muted fill it reads as
          deliberate instead. */}
      <CompetitionIcon
        name={name}
        icon={icon}
        fit="contain"
        className="aspect-4/3 w-full"
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold tracking-tight group-hover:underline">
            {name}
          </p>
          {isDraft ? (
            <Badge variant="secondary" className="shrink-0">
              <PencilRuler />
              Draft
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{organiser}</p>
        {trackCount !== undefined ? (
          <p className="mt-3 border-t border-border pt-3 font-mono text-xs tabular-nums text-muted-foreground">
            {trackCount} {trackCount === 1 ? "track" : "tracks"}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
