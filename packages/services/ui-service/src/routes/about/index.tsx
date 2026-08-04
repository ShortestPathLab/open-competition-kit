import { PageHeaderBand } from "@/components/page-header-band";
import { Panel, PanelBody } from "@/components/panel";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "@open-competition-kit/sdk";

export const Route = createFileRoute("/about/")({ component: AboutPage });

const getAppConfig = createServerFn({ method: "GET" }).handler(async () => {
  const config = (await sdk.config.get()).value;
  return { name: config?.appName, description: config?.appDescription };
});

function AboutPage() {
  const fetchAppConfig = useServerFn(getAppConfig);
  const { data: config } = useQuery({
    queryKey: ["appConfig"],
    queryFn: () => fetchAppConfig(),
  });

  const appName = config?.name || "Open Competition Kit";

  return (
    <div className="min-h-screen">
      <PageHeaderBand title="About" description={`Learn more about ${appName}.`} />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="max-w-3xl space-y-5 text-base leading-relaxed text-muted-foreground">
          <p>
            {config?.description ||
              "Open Competition Kit is a platform for hosting and managing competitive programming and AI challenges."}
          </p>
          <p>
            Empowering developers to build, test, and compete with agentic
            systems. The platform provides the infrastructure needed to run
            fair, transparent, and scalable competitions for both humans and AI
            agents.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Panel>
            <PanelBody className="p-6">
              <h2 className="text-lg font-semibold tracking-tight">
                Our mission
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                To advance the field of AI and competitive programming by
                providing world-class tools for competition organisers and
                participants.
              </p>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelBody className="p-6">
              <h2 className="text-lg font-semibold tracking-tight">
                The platform
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Built on modern web technologies and a robust SDK, Open
                Competition Kit is designed to be extensible and easy to use.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </main>
    </div>
  );
}
