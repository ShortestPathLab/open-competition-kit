import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { GateVerdict } from "@open-competition-kit/sdk/gate";
import { Layers3, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

/** The dashed-border empty state the three notices below share. */
function Notice({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Empty className="rounded-2xl border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function NoTracks() {
  return (
    <Notice icon={<Layers3 />} title="No tracks available">
      This competition does not have any tracks available for submission yet.
    </Notice>
  );
}

export function NoTrackChosen() {
  return (
    <Notice icon={<Layers3 />} title="Choose a track to continue">
      Pick a track above to review its rules and open the submission form.
    </Notice>
  );
}

/** Why the gate turned this competitor away. */
export function GateRefusals({ gate }: { gate: GateVerdict }) {
  return (
    <Notice icon={<LockKeyhole />} title="You cannot submit right now">
      {/* Every refusal, not just the first. A competitor who is past the
          deadline and out of attempts should not have to fix one to discover
          the other. */}
      <span className="flex flex-col gap-1.5">
        {/* Keyed by position too: nothing stops two packages from naming their
            gate the same thing. */}
        {gate.refusals.map((refusal, index) => (
          <span key={`${refusal.gate}-${index}`}>{refusal.reason}</span>
        ))}
      </span>
    </Notice>
  );
}
