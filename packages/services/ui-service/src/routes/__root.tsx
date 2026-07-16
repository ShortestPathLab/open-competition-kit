import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { Navbar } from "*/components/navbar";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "@open-competition-kit/sdk";
import { queryClient } from "src/router";
import appCss from "../styles.css?url";

import { Toaster } from "*/components/ui/sonner";

const getAppConfig = createServerFn({ method: "GET" }).handler(async () => {
  const config = (await sdk.config.get()).value;
  return { name: config?.appName, description: config?.appDescription };
});

export const Route = createRootRoute({
  notFoundComponent: () => <>Not found</>,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OpenCompetitionKit" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23000" /></svg>',
      },
    ],
  }),

  shellComponent: RootDocument,
});

function Shell({ children }: { children: React.ReactNode }) {
  const fetchAppConfig = useServerFn(getAppConfig);

  const { data: config } = useQuery({
    queryKey: ["appConfig"],
    queryFn: () => fetchAppConfig(),
  });

  return (
    <div className="min-h-screen [view-transition-name:main-content]">
      <Navbar appName={config?.name} />
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
            config={{ position: "bottom-right" }}
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
