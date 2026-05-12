import type { Meta, Point, Shape } from "core/hook";
import { z } from "zod";

export const meta = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
}) satisfies z.ZodType<Meta>;
export const value = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const point = z.object({
  key: z.string(),
  value: value.optional(),
  label: z.string().optional(),
}) satisfies z.ZodType<Point>;

export const shape = z.object({
  key: z.string(),
  label: z.string().optional(),
  kind: z.string().optional(),
}) satisfies z.ZodType<Shape>;
