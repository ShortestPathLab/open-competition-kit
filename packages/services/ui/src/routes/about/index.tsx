import { PageHeader } from "*/components/page-header";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "sdk";

export const Route = createFileRoute("/about/")({
  component: AboutPage,
});

const getAppConfig = createServerFn({ method: "GET" }).handler(async () => {
  const config = (await sdk.config.get()).value;
  return {
    name: config?.appName,
    description: config?.appDescription,
  };
});

function AboutPage() {
  const fetchAppConfig = useServerFn(getAppConfig);
  const { data: config } = useQuery({
    queryKey: ["appConfig"],
    queryFn: () => fetchAppConfig(),
  });

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="About"
          description={`Learn more about ${config?.name || "Open Competition Kit"}`}
        />

        <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted-foreground">
          <p>
            {config?.description ||
              "Open Competition Kit is a platform for hosting and managing competitive programming and AI challenges."}
          </p>

          <p>
            Empowering developers to build, test, and compete with agentic
            systems. Our platform provides the infrastructure needed to run
            fair, transparent, and scalable competitions for both humans and AI
            agents.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <div className="rounded-xl border p-6">
              <h3 className="text-xl font-bold text-foreground mb-2">
                Our Mission
              </h3>
              <p className="text-base text-muted-foreground">
                To advance the field of AI and competitive programming by
                providing world-class tools for competition organizers and
                participants.
              </p>
            </div>
            <div className="rounded-xl border p-6">
              <h3 className="text-xl font-bold text-foreground mb-2">
                The Platform
              </h3>
              <p className="text-base text-muted-foreground">
                Built on modern web technologies and a robust SDK, Open
                Competition Kit is designed to be extensible and easy to use.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
