import { Button } from "*/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "*/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import {
  listUserEnrolments,
  type EnrolmentSummary,
} from "src/lib/competition-data";
import { authClient } from "src/lib/auth-client";

export const Route = createFileRoute("/me/")({
  component: MeIndexPage,
});

const getMyEnrolments = createServerFn({ method: "GET" }).handler(
  async (ctx: any) => {
    const userId = ctx.data as string;
    return listUserEnrolments(userId);
  },
);

function MeIndexPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const fetchMyEnrolments = useServerFn(getMyEnrolments);

  const { data: enrolments = [], isLoading } = useQuery({
    queryKey: ["myEnrolments", session?.user?.id],
    queryFn: () => (fetchMyEnrolments as any)({ data: session?.user?.id }),
    enabled: Boolean(session?.user?.id),
  });

  if (sessionLoading) return <div>Loading...</div>;

  if (!session?.user) {
    return (
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Sign in to see your enrolments</CardTitle>
          <CardDescription>
            Your tracks are connected to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/sign-in" />}>Sign in</Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) return <div>Loading enrolments...</div>;

  if (enrolments.length === 0) {
    return (
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>No enrolments yet</CardTitle>
          <CardDescription>
            Pick a competition track to start participating.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/competitions" />}>
            Browse competitions
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {enrolments.map((enrolment: EnrolmentSummary) => (
        <Card key={enrolment.id} className="rounded-lg">
          <CardHeader>
            <CardTitle>{enrolment.track.name}</CardTitle>
            <CardDescription>{enrolment.competition.name}</CardDescription>
            <CardAction>
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {enrolment.track.description}
            </p>
            <Button
              variant="outline"
              render={
                <Link
                  to="/competitions/$id/tracks/$trackId"
                  params={{
                    id: enrolment.track.competitionId || enrolment.competition.id,
                    trackId: enrolment.track.id,
                  }}
                />
              }
            >
              Open track
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
