import { Link } from "@tanstack/react-router";
import BoringAvatar from "boring-avatars";

interface CompetitionCardProps {
  id: string;
  name: string;
  organiser: string;
  trackCount?: number;
  imageUrl?: string;
}

export function CompetitionCard({
  id,
  name,
  organiser,
  trackCount,
  imageUrl,
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
        <p className="font-semibold tracking-tight group-hover:underline">
          {name}
        </p>
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
