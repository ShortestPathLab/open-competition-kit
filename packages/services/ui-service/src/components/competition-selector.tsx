import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import { CompetitionIcon } from "@/components/entity-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardCompetitions } from "@/lib/dashboard-fn";
import { cn } from "@/lib/utils";

interface CompetitionSelectorProps {
  /** The competition currently being organised. */
  competitionId: string;
  name: string;
  className?: string;
}

/**
 * Which competition the dashboard is showing, and a way to change it.
 *
 * A deployment can carry several, and every page under `/dashboard` is scoped to
 * one of them, so the name in the header is also the control that moves between
 * them. It used to be a button with a chevron that did nothing, which is worse
 * than plain text: a chevron is a promise.
 *
 * A dropdown even when there is one competition to pick. A control that appears
 * once a second competition is configured is a control nobody learns, and the
 * menu is not empty in that case anyway: it still holds the way through to the
 * competitor's view of what you are organising.
 */
export function CompetitionSelector({ competitionId, name, className }: CompetitionSelectorProps) {
  const navigate = useNavigate();
  const { data: competitions } = useDashboardCompetitions();

  // Named from the loaded list where it is there, so the trigger and the menu
  // agree even before the page that knows the name has told us.
  const all = competitions ?? [{ id: competitionId, name }];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
          className,
        )}
      >
        <CompetitionIcon name={name} className="size-5 rounded-full" />
        <span className="max-w-48 truncate">{name}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        {/* The label names this group and has to be inside it: on its own it is a
            label for nothing, which Base UI refuses rather than guesses at. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organising</DropdownMenuLabel>
          {all.map((competition) => (
            <DropdownMenuItem
              key={competition.id}
              onClick={() =>
                navigate({
                  to: "/dashboard/$competitionId/overview",
                  params: { competitionId: competition.id },
                })
              }
            >
              <CompetitionIcon name={competition.name} className="size-5 rounded-full" />
              <span className="min-w-0 flex-1 truncate">{competition.name}</span>
              {competition.visibility === "draft" ? (
                <span className="shrink-0 text-xs text-muted-foreground">Draft</span>
              ) : null}
              {competition.id === competitionId ? <Check className="size-4 shrink-0" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link to="/competitions/$id" params={{ id: competitionId }}>
              View as a competitor
            </Link>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
