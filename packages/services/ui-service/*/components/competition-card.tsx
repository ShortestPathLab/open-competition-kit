import { Badge } from "*/components/ui/badge";
import { Link } from "@tanstack/react-router";
import BoringAvatar from "boring-avatars";
import { PencilRuler } from "lucide-react";

interface CompetitionCardProps {
  id: string;
  name: string;
  organiser: string;
  trackCount?: number;
  imageUrl?: string;
  /** Drafts only ever reach an organiser, so the marker is for their benefit. */
  isDraft?: boolean;
}

export function CompetitionCard({
  id,
  name,
  organiser,
  trackCount,
  imageUrl,
  isDraft,
}: CompetitionCardProps) {
  return (
    <Link
      to="/competitions/$id"
      params={{ id }}
      className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-ring"
    >
      <div className="aspect-4/3 bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <BoringAvatar
            name={name}
            square
            preserveAspectRatio="none"
            className="h-full w-full"
          />
        )}
      </div>
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
