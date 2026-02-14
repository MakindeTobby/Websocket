// src/validation/matches.js
import { z } from "zod";

export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
};

export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// const isoDateStringSchema = z.string().refine((value) => {
//   const t = Date.parse(value);
//   return Number.isFinite(t) && new Date(value).toISOString() === value;
// }, "Invalid ISO date string");

export const createMatchSchema = z
  .object({
    sport: z.string().min(1),
    homeTeam: z.string().min(1),
    awayTeam: z.string().min(1),

    startTime: z.iso.datetime,
    endTime: z.iso.datetime,

    homeScore: z.coerce.number().int().min(0).optional(),
    awayScore: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    const start = Date.parse(data.startTime);
    const end = Date.parse(data.endTime);

    // If either is invalid, the field-level refine will already report it.
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "endTime must be chronologically after startTime",
      });
    }
  });

export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().min(0),
  awayScore: z.coerce.number().int().min(0),
});
