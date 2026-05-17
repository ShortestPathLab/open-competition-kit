import type { Meta, Point, Shape } from "@open-competition-kit/core/hook";
import { z } from "zod";

export const meta = z.object({
  name: z.string().optional(),
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
