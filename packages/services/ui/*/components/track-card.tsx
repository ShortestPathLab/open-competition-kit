import { Link } from "@tanstack/react-router";

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
    <div className="flex overflow-hidden rounded-lg border border-border">
      <div className="w-48 shrink-0 bg-muted">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-col justify-between p-4">
        <div>
          <h3 className="font-semibold">{name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Link
            to="/competitions/$id/tracks/$trackId"
            params={{ id: competitionId, trackId: id }}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            More info
          </Link>
          <Link
            to="/competitions/$id/tracks/$trackId"
            params={{ id: competitionId, trackId: id }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </div>
  );
}
