import BoringAvatar from "boring-avatars";
import { cn } from "@/lib/utils";

interface EntityIconProps {
  /** The organiser's picture, when they configured one. */
  src?: string;
  /**
   * What the generated fallback is drawn from.
   *
   * Has to be the same string everywhere one subject appears, or the pattern a
   * reader clicked on is not the pattern that greets them. That is the whole
   * reason the two wrappers below exist rather than callers passing a seed.
   */
  seed: string;
  /**
   * How the picture fills its box. `cover` for the square slots, which crop
   * nothing worth keeping. `contain` where the box is not square and cropping
   * would take a bite out of somebody's logo.
   */
  fit?: "cover" | "contain";
  /** Size and shape. The fill and the clip are supplied. */
  className?: string;
}

/**
 * The picture that stands for a competition or a track.
 *
 * One component so that "organiser's picture, or a pattern generated from a
 * stable seed" is decided once. It was decided in seven places, each with its
 * own wrapper, and only two of them had anywhere for an organiser's picture to
 * go.
 *
 * A `span` rather than a `div` because several of these sit inside a link or a
 * line of text.
 */
function EntityIcon({ src, seed, fit = "cover", className }: EntityIconProps) {
  return (
    <span className={cn("block shrink-0 overflow-hidden bg-muted", className)}>
      {src ?
        // No alt text. Every one of these sits beside the name it stands for,
        // so a screen reader that read both would say everything twice.
        <img
          src={src}
          alt=""
          className={cn(
            "h-full w-full",
            fit === "cover" ? "object-cover" : "object-contain",
          )}
        />
      : <BoringAvatar
          name={seed}
          square
          preserveAspectRatio="none"
          className="h-full w-full"
        />
      }
    </span>
  );
}

export function CompetitionIcon({
  name,
  icon,
  fit,
  className,
}: {
  /** Doubles as the seed, so a competition's pattern follows its name. */
  name: string;
  icon?: string;
  fit?: EntityIconProps["fit"];
  className?: string;
}) {
  return <EntityIcon src={icon} seed={name} fit={fit} className={className} />;
}

export function TrackIcon({
  competitionId,
  trackId,
  icon,
  fit,
  className,
}: {
  competitionId: string;
  trackId: string;
  icon?: string;
  fit?: EntityIconProps["fit"];
  className?: string;
}) {
  return (
    <EntityIcon
      // Qualified by the competition, so two competitions that both call a
      // track `main` do not end up with the same pattern.
      src={icon}
      seed={`${competitionId}.${trackId}`}
      fit={fit}
      className={className}
    />
  );
}
