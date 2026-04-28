import { Button } from "*/components/ui/button";
import { Card } from "*/components/ui/card";
import { CheckCircle2, Lock, UserPlus } from "lucide-react";
import type { ReactNode } from "react";

interface EnrolmentCardProps {
  isSignedIn: boolean;
  isLoading: boolean;
  isEnrolled: boolean;
  enrolAction?: ReactNode;
  submitAction?: ReactNode;
  signInAction?: ReactNode;
  title?: string;
  description?: string;
}

export function EnrolmentCard({
  isSignedIn,
  isLoading,
  isEnrolled,
  enrolAction,
  submitAction,
  signInAction,
}: EnrolmentCardProps) {
  const status = !isSignedIn
    ? {
        label: "Sign in required",
        tone: "text-muted-foreground",
        icon: <Lock className="h-4 w-4" />,
        summary: "Sign in to participate",
      }
    : isEnrolled
      ? {
          label: "Enrolled",
          tone: "text-foreground",
          icon: <CheckCircle2 className="h-4 w-4" />,
          summary: "Ready to submit",
        }
      : {
          label: "Not enrolled",
          tone: "text-muted-foreground",
          icon: <UserPlus className="h-4 w-4" />,
          summary: "Enrol to participate",
        };

  return (
    <Card className="rounded-lg py-0 bg-muted/30">
      <div className="flex flex-col lg:flex-row">
        <div className="border-b border-border p-5 lg:border-r lg:border-b-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {status.icon}
            <span>{status.label}</span>
          </div>
          {!isLoading && (
            <p className="mt-2 text-sm text-muted-foreground">
              {isSignedIn
                ? isEnrolled
                  ? "You're participating in this track."
                  : "You're not yet participating in this track."
                : "Sign in to participate."}
            </p>
          )}
        </div>
        <div className="flex flex-col justify-center w-full p-6 flex-3">
          {isSignedIn ? (
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                {isEnrolled
                  ? "You can submit to this track and review future results."
                  : "Enrol in this track to unlock submissions and participation."}
              </div>
              <div className="flex  items-start gap-3">
                {isEnrolled ? submitAction : enrolAction}
              </div>
            </div>
          ) : (
            <div className="flex gap-4 justify-between items-center ">
              <p className="text-sm">
                Sign in to enrol in this track and create submissions.
              </p>
              <div className="flex items-center gap-3">
                {signInAction ?? <Button>Sign in</Button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
