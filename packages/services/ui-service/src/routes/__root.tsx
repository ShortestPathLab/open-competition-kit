import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { Navbar } from "@/components/navbar";
import { bannerVars, useBanner } from "@/lib/banner";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "@open-competition-kit/sdk";
import { queryClient } from "@/router";
import appCss from "../styles.css?url";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const getAppConfig = createServerFn({ method: "GET" }).handler(async () => {
  const config = (await sdk.config.get()).value;
  return { name: config?.name, description: config?.description };
});

export const Route = createRootRoute({
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

  // A competition's banner is painted across the navbar and the header band,
  // which are siblings below this point and cannot see each other. This is the
  // one element above both, so the picture and its tone are published here and
  // picked up by whichever of them is painting. Deciding it twice is how the
  // two halves end up disagreeing. See `.banner-chrome` in `styles.css`.
  const banner = useBanner();

  return (
    <div
      className="min-h-screen [view-transition-name:main-content]"
      data-banner-tone={banner?.tone}
      style={bannerVars(banner)}
    >
      <Navbar appName={config?.name} />
      {children}
    </div>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
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
        </ThemeProvider>
      </body>
    </html>
  );
}
