import { Link } from "@tanstack/react-router";

interface CompetitionCardProps {
  id: string;
  name: string;
  organiser: string;
  imageUrl?: string;
}

export function CompetitionCard({
  id,
  name,
  organiser,
  imageUrl,
}: CompetitionCardProps) {
  return (
    <Link
      to="/competitions/$id"
      params={{ id }}
      className="group block rounded-lg border border-border overflow-hidden"
    >
      <div className="aspect-[4/3] bg-muted">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="p-3">
        <p className="font-medium group-hover:underline">{name}</p>
        <p className="text-sm text-muted-foreground">{organiser}</p>
      </div>
    </Link>
  );
}
