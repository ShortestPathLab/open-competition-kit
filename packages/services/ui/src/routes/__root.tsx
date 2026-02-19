import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import appCss from "../styles.css?url";
import { queryClient } from "src/router";
import { Navbar } from "*/components/navbar";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "sdk";

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
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
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
      <Navbar variant="admin" appName={config?.name} />
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
      </body>
    </html>
  );
}
