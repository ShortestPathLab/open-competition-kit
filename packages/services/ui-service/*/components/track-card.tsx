import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import BoringAvatar from "boring-avatars";

interface TrackCardProps {
  id: string;
  competitionId: string;
  name: string;
  description: string;
  imageUrl?: string;
}

export function TrackCard({
  id,
  competitionId,
  name,
  description,
  imageUrl,
}: TrackCardProps) {
  return (
    <Link
      to="/competitions/$id/tracks/$trackId"
      params={{ id: competitionId, trackId: id }}
      className="group flex gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-ring"
    >
      <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <BoringAvatar
            name={`${competitionId}.${id}`}
            square
            preserveAspectRatio="none"
            className="h-full w-full"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight">{name}</h3>
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </Link>
  );
}
