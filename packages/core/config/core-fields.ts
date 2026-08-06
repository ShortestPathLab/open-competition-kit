/**
 * Core's own fields, described the way a package describes its own.
 *
 * `CORE_KEYS` already lists what core declares at each node, but a list of names
 * is what a validator needs, not what an editor does: it says nothing about what
 * to call a field on screen, what sort of control it wants, or which of them an
 * organiser has any business changing from a web page. This is that half, and it
 * is written by hand for the same reason a package writes its own by hand.
 *
 * The omissions are the interesting part. Three groups are deliberately absent:
 *
 * Identity. A competition's `id` is what every enrolment, submission and job row
 * in the database points at. Renaming it in the config does not rename those, so
 * the edit would read as a rename and land as a disappearance.
 *
 * Structure. `tracks`, `leaderboards`, `competitions`, `shape`, `form`, `with`
 * and `without` describe what a competition is made of rather than how it
 * behaves. A form that offered to add a leaderboard would be a config file
 * editor with worse ergonomics than the config file, and it would have to
 * express `${{ yaml("./boards.yaml") }}` to boot.
 *
 * Credentials and access. `secrets`, `auth` and `admins` decide who can reach
 * what. A page reachable by whoever is already an admin should not be the place
 * the admin list is edited, and the other two are where the deployment keeps
 * everything worth stealing.
 *
 * Pictures are left out too, on plainer grounds: `icon` and `banner` are usually
 * `dataUrl()` inlines running to hundreds of kilobytes, and a text box is not an
 * image picker.
 */
import type { FieldPresentation } from "../common/shape";
import type { NodeKind } from "./extension";

const MARKDOWN = "The page is rendered as Markdown.";

/**
 * What an organiser may change at each kind of node, in the order it should be
 * drawn. A kind absent from here has nothing of core's worth editing: `db`,
 * `files`, `machine` and `runner` are blocks core declares the existence of and
 * nothing about, so every field on them belongs to a package.
 */
export const CORE_FIELDS: Partial<Record<NodeKind, readonly FieldPresentation[]>> = {
  root: [
    {
      id: "name",
      label: "Site name",
      kind: "text",
      description: "Shown in the navigation bar and used to generate the site's avatar.",
    },
    {
      id: "description",
      label: "Site description",
      kind: "text",
      description: "One line about what this deployment is for.",
    },
  ],

  competition: [
    { id: "name", label: "Name", kind: "text", description: "What the competition is called." },
    {
      id: "organiser",
      label: "Organiser",
      kind: "text",
      description: "Who is running it. Shown under the name wherever the competition is listed.",
    },
    {
      id: "visibility",
      label: "Visibility",
      kind: "select",
      options: [
        { value: "published", label: "Published" },
        { value: "draft", label: "Draft" },
      ],
      description:
        "A draft is visible to the organisers listed in admins and to nobody else. Its pages read as missing, and it takes no entries or submissions.",
    },
    {
      id: "description",
      label: "Short description",
      kind: "text",
      description: "One or two sentences, shown on the competition's card in the index.",
    },
    {
      id: "overview",
      label: "Overview",
      kind: "markdown",
      description: `The competition's front page, under its header. ${MARKDOWN}`,
    },
    {
      id: "rules",
      label: "Rules",
      kind: "markdown",
      description: `The rules page. ${MARKDOWN}`,
    },
  ],

  track: [
    { id: "name", label: "Name", kind: "text", description: "What the track is called." },
    {
      id: "description",
      label: "Short description",
      kind: "text",
      description: "One line, shown on the track's card and beside it in lists.",
    },
    {
      id: "overview",
      label: "Overview",
      kind: "markdown",
      description: `The track's own page, above its submission form. ${MARKDOWN}`,
    },
    {
      id: "rules",
      label: "Rules",
      kind: "markdown",
      description: `Rules specific to this track, shown beside the submission form. ${MARKDOWN}`,
    },
  ],

  form: [
    {
      id: "label",
      label: "Form heading",
      kind: "text",
      description: "Shown above the submission form. Leave empty for no heading.",
    },
    {
      id: "description",
      label: "Form description",
      kind: "text",
      description: "Guidance shown under the heading, before the first field.",
    },
  ],

  formField: [
    {
      id: "name",
      label: "Field name",
      kind: "text",
      description: "What this answer is called on the form.",
    },
    {
      id: "label",
      label: "Label",
      kind: "text",
      description: "Overrides the name on screen, where the two should differ.",
    },
    {
      id: "description",
      label: "Help text",
      kind: "text",
      description: "Shown under the control, for anything the label cannot say.",
    },
    {
      id: "kind",
      label: "Control",
      kind: "text",
      description:
        "Which control draws this field. An open string: a package may provide its own, e.g. github:ref-select. A kind no installed package answers for falls back to a text box.",
    },
  ],

  leaderboard: [
    { id: "name", label: "Name", kind: "text", description: "The board's heading." },
    {
      id: "description",
      label: "Description",
      kind: "text",
      description: "One line under the heading, saying what the board ranks.",
    },
    {
      id: "kind",
      label: "Renderer",
      kind: "text",
      description:
        "Which installed renderer draws this board, e.g. card or chart. Leave empty for whichever offers a default look.",
    },
  ],
};

/** Whether core describes any editable field at this kind of node. */
export const hasCoreFields = (kind: NodeKind) => (CORE_FIELDS[kind]?.length ?? 0) > 0;
