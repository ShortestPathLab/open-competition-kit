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
import { Lock } from "lucide-react";

export function SignedOut() {
  return (
    <Empty className="rounded-xl border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock />
        </EmptyMedia>
        <EmptyTitle>Sign in to view your dashboard</EmptyTitle>
        <EmptyDescription>
          Your competition activity is connected to your account.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="lg" className="h-10 px-5" render={<Link to="/sign-in" />}>
          Sign in
        </Button>
      </EmptyContent>
    </Empty>
  );
}
