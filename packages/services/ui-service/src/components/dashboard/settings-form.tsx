import { omit } from "es-toolkit";
import { AlertTriangle, Check, Copy, Info, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  controlKindOf,
  SettingControl,
  type SettingField,
  type SettingValue,
} from "@/components/dashboard/setting-control";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/panel";
import { Button } from "@/components/ui/button";
import type {
  ConfigEdit,
  ConfigNodeDescription,
  ConfigWriteResult,
} from "@/lib/dashboard-config-fn";
import { cn } from "@/lib/utils";

/** Edited values, by node path and then by field id. */
type Draft = Record<string, Record<string, SettingValue>>;

/** A field the reader has typed something unparseable into, by control id. */
type Malformed = Record<string, string>;

const controlId = (path: string, fieldId: string) => `${path}:${fieldId}`;

/** Every field on one node, core's own first, then each package's. */
const fieldsOf = (node: ConfigNodeDescription) => [
  ...node.core,
  ...node.sections.flatMap((section) => section.fields),
];

/**
 * Values the reader has changed, against what the config currently has.
 *
 * Compared by JSON rather than by reference, since a JSON control rebuilds its
 * object on every keystroke and would otherwise count as dirty the moment it was
 * touched, whatever it ended up saying.
 *
 * A secret has no current value to compare against, so anything typed into one
 * counts. There is no way to type a credential that matches the one already
 * there, and no way to tell if you did.
 *
 * Each changed field is sent with what it held when this page was drawn. The
 * config is a file with other authors, and without that the save cannot tell a
 * field somebody else changed in the meantime from one nobody has touched.
 */
function changedIn(node: ConfigNodeDescription, draft: Draft): ConfigEdit | undefined {
  const edited = draft[node.path];
  if (!edited) return undefined;

  const fields = new Map(fieldsOf(node).map((field) => [field.id, field]));

  const values: Record<string, SettingValue> = {};
  const expect: Record<string, SettingValue> = {};
  let any = false;

  for (const [id, value] of Object.entries(edited)) {
    const field = fields.get(id);
    if (!field?.secret && JSON.stringify(value) === JSON.stringify(field?.value)) continue;
    // An untouched secret box reads as empty, which would clear the credential
    // rather than leave it. Only a typed one is an edit.
    if (field?.secret && value === undefined) continue;
    values[id] = value;
    // A secret was never handed a value to show, so there is nothing here to
    // compare and nothing worth claiming.
    if (!field?.secret) expect[id] = field?.value;
    any = true;
  }

  return any ? { path: node.path, values, expect } : undefined;
}

/**
 * What core's own fields are called at each kind of node.
 *
 * "General" everywhere would be true and useless. A panel headed "Competition"
 * over a name and a set of rules says which thing is being named.
 */
const CORE_SECTION_LABELS: Partial<Record<ConfigNodeDescription["kind"], string>> = {
  root: "Site",
  competition: "Competition",
  track: "Track",
  form: "Submission form",
  formField: "Form field",
  leaderboard: "Leaderboard",
};

/** One group of fields on one node: core's own, or one package's contribution. */
function SettingSection({
  title,
  source,
  fields,
  node,
  draft,
  malformed,
  onChange,
  onInvalid,
}: {
  title: string;
  /** The `with:` entry that declared these. Absent for core's own fields. */
  source?: string;
  fields: SettingField[];
  node: ConfigNodeDescription;
  draft: Draft;
  malformed: Malformed;
  onChange: (path: string, fieldId: string, value: SettingValue) => void;
  onInvalid: (id: string, message: string | undefined) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/40 px-5 py-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
        {source ? (
          <code className="font-mono text-[11px] text-muted-foreground">{source}</code>
        ) : null}
      </div>

      <div className="divide-y divide-border">
        {fields.map((field) => {
          const id = controlId(node.path, field.id);
          const edited = draft[node.path]?.[field.id];
          const value = field.id in (draft[node.path] ?? {}) ? edited : field.value;
          const kind = controlKindOf(field);

          return (
            <div
              key={field.id}
              className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-start"
            >
              <div className="min-w-0">
                <label htmlFor={id} className="text-sm font-medium">
                  {field.label ?? field.name ?? field.id}
                  {/* Every instant on the dashboard is reported in UTC, and a
                      box that sets one has to say so or it reads as the
                      reader's own clock. */}
                  {kind === "datetime" ? (
                    <span className="ml-1.5 font-normal text-muted-foreground">(UTC)</span>
                  ) : null}
                </label>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{field.id}</p>
                {kind === "secret" ? (
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      field.set ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {field.set ? "Configured" : "Not set"}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0">
                <SettingControl
                  id={id}
                  field={field}
                  value={value}
                  onChange={(next) => onChange(node.path, field.id, next)}
                  onInvalid={(message) => onInvalid(id, message)}
                />
                {malformed[id] ? (
                  <p className="mt-1.5 text-xs text-destructive">{malformed[id]}</p>
                ) : field.description ? (
                  <p className="mt-1.5 max-w-prose text-xs text-muted-foreground">
                    {field.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The YAML the kit produced, with a way to take it somewhere else. */
function YamlBlock({ yaml }: { yaml: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-3 py-1.5">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          To paste
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-xs"
          onClick={() =>
            navigator.clipboard?.writeText(yaml).then(
              () => setCopied(true),
              () => undefined,
            )
          }
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-xs">{yaml}</pre>
    </div>
  );
}

/**
 * Every package-declared setting that applies to this competition, as a form.
 *
 * Nothing here knows what a deadline or a bucket name is. The fields, their
 * labels, their help text and their types all come from `config.describe`, which
 * reads them off the packages the organiser installed; the edited values go back
 * through `config.set`, which checks them against those same packages' schemas.
 * A package that adds a field gets an editor for it and a line changes nowhere.
 */
export function SettingsForm({
  settings,
  /**
   * Whether the config file can be saved to. Answered by the kit, which asks the
   * file itself, so a read only mount changes what this offers to do rather than
   * being discovered when somebody presses the button.
   */
  canStore,
  saving,
  result,
  onSave,
  onRestart,
}: {
  settings: ConfigNodeDescription[];
  canStore: boolean;
  saving: boolean;
  result?: ConfigWriteResult;
  onSave: (edits: ConfigEdit[]) => void;
  /** Ask to restart, for a change already saved. */
  onRestart: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({});
  const [malformed, setMalformed] = useState<Malformed>({});
  // Discarding has to reach the JSON textareas, which are uncontrolled so that
  // typing an object is not fought character by character. Remounting the form
  // is what puts them back to the config's own values.
  const [generation, setGeneration] = useState(0);

  const discard = () => {
    setDraft({});
    setMalformed({});
    setGeneration((current) => current + 1);
  };

  const edits = useMemo(
    () => settings.flatMap((node) => changedIn(node, draft) ?? []),
    [settings, draft],
  );

  const badFields = Object.values(malformed).filter(Boolean);
  const issuesByPath = new Map((result?.issues ?? []).map((issue) => [issue.path, issue.message]));

  const set = (path: string, fieldId: string, value: SettingValue) =>
    setDraft((current) => ({
      ...current,
      [path]: { ...current[path], [fieldId]: value },
    }));

  const markMalformed = (id: string, message: string | undefined) =>
    setMalformed((current) => {
      if (message) return { ...current, [id]: message };
      // Same object back when there was nothing to clear, so a valid keystroke
      // in one field does not re-render every other field's error state.
      return id in current ? omit(current, [id]) : current;
    });

  if (settings.length === 0) {
    return (
      <Panel>
        <PanelBody className="text-sm text-muted-foreground">
          Nothing here is editable. Core declares no settable field on this competition, and no
          installed package declares one either.
        </PanelBody>
      </Panel>
    );
  }

  return (
    <form
      key={generation}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(edits);
      }}
    >
      {settings.map((node) => {
        const nodeIssue = issuesByPath.get(node.path);

        return (
          <Panel key={node.path} className={cn(nodeIssue && "border-destructive/50")}>
            <PanelHeader>
              <PanelTitle>{node.label}</PanelTitle>
              <code className="font-mono text-xs text-muted-foreground">{node.path}</code>
            </PanelHeader>

            {nodeIssue ? (
              <div className="flex items-start gap-2 border-b border-border bg-destructive/8 px-5 py-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{nodeIssue}</span>
              </div>
            ) : null}

            {/* Core's own fields lead. A competition's name is the first thing
                an organiser came here to change, and burying it under whichever
                package happened to install itself first would be an accident of
                packaging deciding the reading order. */}
            {node.core.length ? (
              <SettingSection
                title={CORE_SECTION_LABELS[node.kind] ?? "General"}
                fields={node.core}
                node={node}
                draft={draft}
                malformed={malformed}
                onChange={set}
                onInvalid={markMalformed}
              />
            ) : null}

            {node.sections.map((section) => (
              <SettingSection
                key={`${node.path}:${section.source}:${section.group?.id ?? ""}`}
                title={section.group?.label ?? "Settings"}
                // Which package owns these fields. An organiser deciding whether
                // a setting still applies needs to know what would stop reading
                // it if they removed the package.
                source={section.source}
                fields={section.fields}
                node={node}
                draft={draft}
                malformed={malformed}
                onChange={set}
                onInvalid={markMalformed}
              />
            ))}
          </Panel>
        );
      })}

      {result?.stored ? (
        <Panel className="border-success/40">
          <PanelHeader>
            <PanelTitle>Saved</PanelTitle>
          </PanelHeader>
          <PanelBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                Written to <code className="font-mono text-xs">{result.file}</code>. The change
                applies when the service starts again.
              </span>
            </p>
            <Button type="button" variant="outline" onClick={onRestart}>
              <RefreshCw />
              Restart
            </Button>
          </PanelBody>
        </Panel>
      ) : result?.accepted && result.yaml ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>Valid, and not saved</PanelTitle>
          </PanelHeader>
          <PanelBody className="flex flex-col gap-3">
            {result.reason ? (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>{result.reason}</span>
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              These lines are what the change comes to. Put them under the node they belong to in
              the config file, and restart.
            </p>
            <YamlBlock yaml={result.yaml} />
          </PanelBody>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {badFields.length ? (
          <p className="mr-auto text-sm text-destructive">
            {badFields.length === 1
              ? "One field is not valid JSON yet."
              : `${badFields.length} fields are not valid JSON yet.`}
          </p>
        ) : edits.length ? (
          <p className="mr-auto text-sm text-muted-foreground">
            {edits.length === 1 ? "1 section changed" : `${edits.length} sections changed`}
          </p>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          disabled={edits.length === 0 || saving}
          onClick={discard}
        >
          <RotateCcw />
          Discard
        </Button>
        <Button type="submit" disabled={edits.length === 0 || badFields.length > 0 || saving}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {canStore ? "Save changes" : "Check changes"}
        </Button>
      </div>
    </form>
  );
}
