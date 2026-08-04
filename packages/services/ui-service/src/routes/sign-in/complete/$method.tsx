import { Loader } from "*/components/loader";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "src/lib/auth-client";
import { configureUser } from "src/lib/configure-user";

export const Route = createFileRoute("/sign-in/complete/$method")({
  component: RouteComponent,
});

function RouteComponent() {
  const { method } = Route.useParams();
  const { data } = authClient.useSession();
  const navigate = useNavigate();
  useEffect(() => {
    const g = async () => {
      if (data) {
        const { data: accounts } = await authClient.listAccounts();
        const account = accounts?.find?.((c) => c.providerId === method);
        await configureUser({ data: { user: data.user, method, account } });
        navigate({ to: "/" });
      }
    };
    g();
  }, [data, method, navigate]);
  return <Loader />;
}
