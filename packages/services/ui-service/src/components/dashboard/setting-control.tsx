import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ConfigNodeDescription } from "@/lib/dashboard-config-fn";

export type SettingField = ConfigNodeDescription["sections"][number]["fields"][number];
export type SettingValue = SettingField["value"];

/**
 * What sort of control a field gets.
 *
 * `kind` is the package's own word for it, taken from the `shape` it declared
 * next to its schema. A package that declared no shape gets whatever its current
 * value looks like, which is a guess, but a guess that has been right every time
 * the value is set and only ever produces a text box when it is not.
 */
export type ControlKind =
  | "text"
  | "markdown"
  | "select"
  | "secret"
  | "number"
  | "boolean"
  | "datetime"
  | "json";

export function controlKindOf(field: SettingField): ControlKind {
  // Ahead of `kind`, because how a value is protected outranks how it is typed:
  // an access key is text, and drawing it as text is the whole problem.
  if (field.secret) return "secret";
  // A picker needs choices more than it needs a matching `kind`, so a field that
  // supplied them gets one whatever it called itself.
  if (field.options?.length) return "select";

  switch (field.kind) {
    case "text":
    case "string":
      return "text";
    case "markdown":
    case "textarea":
      return "markdown";
    case "select":
    case "enum":
      return "select";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "datetime":
    case "date":
      return "datetime";
    case "object":
    case "array":
      return "json";
  }

  const value = field.value;
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (value !== null && typeof value === "object") return "json";
  return "text";
}

/**
 * An instant as a `datetime-local` input wants it, read in UTC.
 *
 * UTC rather than the reader's own zone for the reason every date on the
 * dashboard is: the page renders on a server that is rarely in the reader's
 * zone, so a local reading gives hydration a different value than it rendered.
 * It is also the zone the rest of the dashboard reports in, and a deadline shown
 * one way on the submissions list and another in the box that sets it is worse
 * than either.
 */
function toUtcInput(value: SettingValue): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  );
}

/** JSON with its braces on separate lines, for a value only a textarea can hold. */
export function toJsonText(value: SettingValue): string {
  if (value === undefined || value === null) return "";
  return JSON.stringify(value, null, 2);
}

/**
 * One package-declared field, as the control its kind asks for.
 *
 * `undefined` means the organiser never set it, which is different from setting
 * it to nothing: an absent key is a field a package reads its own default for,
 * and an empty string is a value. Clearing a control sends `undefined` back, so
 * unsetting is expressible.
 */
export function SettingControl({
  id,
  field,
  value,
  onChange,
  onInvalid,
}: {
  id: string;
  field: SettingField;
  value: SettingValue;
  onChange: (value: SettingValue) => void;
  /** JSON that will not parse, reported so the form can refuse to submit it. */
  onInvalid: (message: string | undefined) => void;
}) {
  const kind = controlKindOf(field);

  if (kind === "secret") {
    return (
      <Input
        id={id}
        type="password"
        autoComplete="off"
        // The value is never sent to the browser, so there is nothing to show
        // and nothing to edit in place. Typing replaces it; leaving it alone
        // leaves it alone, which is why an empty box means "unchanged" here and
        // "unset" everywhere else.
        placeholder={field.set ? "Set. Type to replace it." : "Not set"}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onChange(next === "" ? undefined : next);
        }}
      />
    );
  }

  if (kind === "select") {
    return (
      <select
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onChange(next === "" ? undefined : next);
        }}
        className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">Not set</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "markdown") {
    return (
      <Textarea
        id={id}
        rows={10}
        // Uncontrolled, so typing a long page is not fought a character at a
        // time. The form remounts on discard, which is what puts it back.
        defaultValue={typeof value === "string" ? value : ""}
        placeholder="Not set"
        className="font-mono text-xs"
        onChange={(event) => {
          const next = event.currentTarget.value;
          onChange(next === "" ? undefined : next);
        }}
      />
    );
  }

  if (kind === "boolean") {
    return (
      <Switch
        id={id}
        checked={value === true}
        onCheckedChange={(checked: boolean) => onChange(checked)}
      />
    );
  }

  if (kind === "number") {
    return (
      <Input
        id={id}
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        placeholder="Not set"
        onChange={(event) => {
          const next = event.currentTarget.value;
          onChange(next === "" ? undefined : Number(next));
        }}
      />
    );
  }

  if (kind === "datetime") {
    return (
      <Input
        id={id}
        type="datetime-local"
        value={toUtcInput(value)}
        onChange={(event) => {
          const next = event.currentTarget.value;
          // Back out to a full instant with an offset on it. The control's own
          // value carries no zone, and a package handed one without would read
          // it in whichever zone the host happens to be in.
          onChange(next === "" ? undefined : `${next}:00.000Z`);
        }}
      />
    );
  }

  if (kind === "json") {
    return (
      <Textarea
        id={id}
        rows={4}
        spellCheck={false}
        className="font-mono text-xs"
        defaultValue={toJsonText(value)}
        placeholder="Not set"
        onChange={(event) => {
          const text = event.currentTarget.value.trim();
          if (text === "") {
            onInvalid(undefined);
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(text) as SettingValue);
            onInvalid(undefined);
          } catch {
            // Held back rather than sent. A half-typed object is not an edit
            // anybody meant to make, and the schema's complaint about it would
            // be about the wrong thing.
            onInvalid("This needs to be valid JSON.");
          }
        }}
      />
    );
  }

  return (
    <Input
      id={id}
      value={value === undefined || value === null ? "" : String(value)}
      placeholder="Not set"
      onChange={(event) => {
        const next = event.currentTarget.value;
        onChange(next === "" ? undefined : next);
      }}
    />
  );
}
