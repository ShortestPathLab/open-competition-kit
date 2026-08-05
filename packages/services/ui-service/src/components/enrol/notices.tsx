import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Link } from "@tanstack/react-router";
import { Layers3, Lock } from "lucide-react";

export function SignInToEnrol() {
  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock />
        </EmptyMedia>
        <EmptyTitle>Sign in to enrol</EmptyTitle>
        <EmptyDescription>Your enrolments are attached to your account.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link to="/sign-in" />}>Sign in</Button>
      </EmptyContent>
    </Empty>
  );
}

export function NoTracks() {
  return (
    <Empty className="rounded-2xl border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Layers3 />
        </EmptyMedia>
        <EmptyTitle>No tracks available</EmptyTitle>
        <EmptyDescription>
          This competition does not have any tracks available yet.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
