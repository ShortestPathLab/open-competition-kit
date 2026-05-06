import Form from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import React from "react";
import type { ComponentDef } from "sdk";

const schema: RJSFSchema = {
  title: "Competition Registration",
  description: "A sample JSON schema form rendered with react-jsonschema-form.",
  type: "object",
  required: ["teamName", "contactEmail", "track"],
  properties: {
    teamName: {
      type: "string",
      title: "Team name",
      minLength: 2,
    },
    contactEmail: {
      type: "string",
      title: "Contact email",
      format: "email",
    },
    track: {
      title: "Track",
      oneOf: [
        { const: "vision", title: "Vision" },
        { const: "nlp", title: "NLP" },
        { const: "forecasting", title: "Forecasting" },
      ],
    },
    acceptRules: {
      type: "boolean",
      title: "I agree to the competition rules",
      default: false,
    },
    notes: {
      type: "string",
      title: "Notes",
    },
  },
};

const uiSchema: UiSchema = {
  teamName: {
    "ui:placeholder": "Enter your team name",
  },
  contactEmail: {
    "ui:placeholder": "team@example.com",
  },
  track: {
    "ui:placeholder": "Choose a track",
  },
  notes: {
    "ui:widget": "textarea",
    "ui:options": {
      rows: 5,
    },
    "ui:placeholder": "Share anything the organizers should know",
  },
  "ui:submitButtonOptions": {
    submitText: "Submit registration",
  },
};

const formData = {
  track: "vision",
};

export function JsonForm() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@rjsf/shadcn@6.5.2/dist/default.css"
      />
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.2.4/dist/index.global.min.js" />
      <div className="grid gap-5 bg-linear-to-b from-orange-50 via-amber-50 to-white p-6">
        <div>
          <h2 className="m-0 text-2xl font-semibold tracking-tight text-stone-950">
            JSON Schema Form Sample
          </h2>
          <p className="mt-2 text-stone-600">
            This package renders a form UI from JSON schema using the shadcn
            theme from `react-jsonschema-form`.
          </p>
        </div>

        <div className="rounded-4xl border border-orange-200 bg-white p-6 shadow-[0_18px_40px_rgba(120,53,15,0.08)]">
          <Form
            schema={schema}
            uiSchema={uiSchema}
            formData={formData}
            validator={validator}
            onSubmit={({ formData }) => {
              console.log("Submitted form data", formData);
            }}
          />
        </div>
      </div>
    </>
  );
}

export default {
  component: JsonForm,
  path: import.meta.path,
} satisfies ComponentDef;
