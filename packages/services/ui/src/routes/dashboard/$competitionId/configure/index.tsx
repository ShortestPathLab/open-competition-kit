import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import sdk from "sdk";
import { SectionHeader } from "*/components/section-header";
import { FormField } from "*/components/form-field";
import { IconUpload } from "*/components/icon-upload";
import {
  FileEdit,
  ChevronDown,
  Mail,
  Bold,
  Italic,
  Link,
  List,
  ListOrdered,
} from "lucide-react";
import { z } from "zod";

const getCompetitionConfig = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    // TODO: Implement SDK function
    // @ts-ignore
    const _config = await sdk.competitions.getConfig(id);

    return {
      name: "GPPC 2025",
      contactEmail: "olivia@untitledui.com",
      description: "Lorem ipsum sit amet.",
      database: {
        type: "MongoDB",
        url: "mongodb://smsthsmth",
      },
    };
  });

export const Route = createFileRoute("/dashboard/$competitionId/configure/")({
  component: ConfigurePage,
});

function ConfigurePage() {
  const { competitionId } = Route.useParams();
  const fetchConfig = useServerFn(getCompetitionConfig);

  const { data: config } = useQuery({
    queryKey: ["competitionConfig", competitionId],
    queryFn: () => (fetchConfig as any)({ data: competitionId }),
  });

  if (!config) return <div className="p-6">Loading...</div>;

  return (
    <div className="flex flex-col gap-8">
      {/* Competition Settings */}
      <section>
        <SectionHeader
          title="Competition settings"
          description="Change your competition settings here."
          actions={
            <>
              <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm">
                <FileEdit className="h-4 w-4" />
                Edit as YAML
              </button>
              <button className="rounded-md border border-border px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                Save
              </button>
            </>
          }
        />
        <div className="mt-2">
          <FormField label="Name">
            <input
              type="text"
              defaultValue={config.name}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Contact email">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                defaultValue={config.contactEmail}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </FormField>
          <FormField
            label="Icon"
            description="This will be displayed publicly."
          >
            <IconUpload />
          </FormField>
          <FormField
            label="Description"
            description="Write a short description."
          >
            <div>
              <div className="flex items-center gap-1 border border-border rounded-t-md px-2 py-1.5">
                <select className="rounded border-0 bg-transparent text-sm focus:outline-none">
                  <option>Normal text</option>
                  <option>Heading 1</option>
                  <option>Heading 2</option>
                </select>
                <div className="mx-2 h-4 w-px bg-border" />
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  <Bold className="h-4 w-4" />
                </button>
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  <Italic className="h-4 w-4" />
                </button>
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  <Link className="h-4 w-4" />
                </button>
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  <List className="h-4 w-4" />
                </button>
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  <ListOrdered className="h-4 w-4" />
                </button>
              </div>
              <textarea
                defaultValue={config.description}
                rows={4}
                className="w-full rounded-b-md border border-t-0 border-input bg-background px-3 py-2 text-sm resize-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                275 characters left
              </p>
            </div>
          </FormField>
        </div>
      </section>

      {/* Database Settings */}
      <section>
        <SectionHeader
          title="Database settings"
          description="Change your database settings here."
        />
        <div className="mt-2">
          <FormField label="Database type">
            <button className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {config.database.type}
                </span>
                <span className="text-xs text-muted-foreground">
                  Best for high-performance smth smth
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </FormField>
          <FormField label="Database URL">
            <input
              type="text"
              defaultValue={config.database.url}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </FormField>
        </div>
      </section>

      {/* Tracks */}
      <section>
        <SectionHeader
          title="Tracks"
          description="Add, remove and configure tracks."
        />
        <div className="mt-6 flex items-center justify-center rounded-lg border-2 border-dashed border-border p-12">
          <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Open track editor
          </button>
        </div>
      </section>

      {/* Bottom actions */}
      <div className="flex items-center justify-end gap-2 border-t border-border ">
        <button className="rounded-md border border-border px-3 py-1.5 text-sm">
          Cancel
        </button>
        <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          Save
        </button>
      </div>
    </div>
  );
}
