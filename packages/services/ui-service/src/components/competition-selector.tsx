import { ChevronDown } from "lucide-react";

interface CompetitionSelectorProps {
  name: string;
}

export function CompetitionSelector({ name }: CompetitionSelectorProps) {
  return (
    <button className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
      <div className="h-5 w-5 rounded-full bg-muted" />
      <span>{name}</span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
