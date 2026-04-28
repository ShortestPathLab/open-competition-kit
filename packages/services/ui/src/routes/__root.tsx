import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import appCss from "../styles.css?url";
import { queryClient } from "src/router";
import { Navbar } from "*/components/navbar";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "sdk";
import { authClient } from "src/lib/auth-client";

const getAppConfig = createServerFn({ method: "GET" }).handler(async () => {
  const config = (await sdk.config.get()).value;
  return {
    name: config?.appName,
    description: config?.appDescription,
  };
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "OpenCompetitionKit",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23000" /></svg>',
      },
    ],
  }),

  shellComponent: RootDocument,
});

import { useEffect } from "react";
import { ensureUserExists } from "src/lib/ensure-user";
import { Toaster } from "*/components/ui/sonner";

function Shell({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const fetchAppConfig = useServerFn(getAppConfig);
  const syncUser = useServerFn(ensureUserExists);

  const { data: config } = useQuery({
    queryKey: ["appConfig"],
    queryFn: () => fetchAppConfig(),
  });

  useEffect(() => {
    if (session?.user) {
      syncUser({
        data: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        },
      }).catch((err: any) => console.error("Failed to sync user", err));
    }
  }, [session?.user, syncUser]);

  return (
    <div className="min-h-screen [view-transition-name:main-content]">
      <Navbar
        variant={session?.user ? "admin" : "public"}
        appName={config?.name}
      />
      {children}
    </div>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Shell>{children}</Shell>
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
          <Scripts />
        </QueryClientProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
