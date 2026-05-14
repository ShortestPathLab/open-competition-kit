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
      className="block overflow-hidden rounded-lg border border-border bg-background hover:border-foreground/20"
    >
      <div className="flex min-h-56 flex-col lg:grid lg:grid-cols-[220px_1fr]">
        <div className="bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="h-full min-h-44 w-full object-cover"
            />
          ) : (
            <BoringAvatar
              className="w-full h-full"
              name={`${competitionId}.${id}`}
              square
              preserveAspectRatio="none"
            />
          )}
        </div>
        <div className="flex flex-col justify-between p-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Track</p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  {name}
                </h3>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Open this track to view participation details, enrolment status,
              and submission options.
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
