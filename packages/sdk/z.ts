import type { Meta, Point, Shape } from "@open-competition-kit/core/hook";
import { z } from "zod";

/**
 * Mirrors `Meta` from core.
 *
 * The field is `label`, not `name`. Zod strips what a schema does not declare,
 * and `satisfies z.ZodType<Meta>` cannot catch the difference because every
 * field on both sides is optional, so any all-optional object satisfies it.
 * Naming the wrong one here means a renderer parses the definition, loses the
 * title, and falls back to a placeholder with nothing to show for it.
 */
export const meta = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
}) satisfies z.ZodType<Meta>;
export const value = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const point = z.object({
  id: z.string(),
  value: value.optional(),
  name: z.string().optional(),
}) satisfies z.ZodType<Point>;

export const shape = z.object({
  id: z.string(),
  name: z.string().optional(),
  kind: z.string().optional(),
}) satisfies z.ZodType<Shape>;
