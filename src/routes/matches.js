import { Router } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
} from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js"; // ✅ make sure this import exists
import { getMatchStatus } from "../utils/match-status.js";
import { desc } from "drizzle-orm";

export const matchRouter = Router();
const MAX_LIMIT = 100;

matchRouter.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid Query",
      details: parsed.error.issues(), // nicer than JSON.stringify
    });
  }
  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);
  try {
    const data = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);
    res.json({ data });
  } catch (e) {
    console.error("DRIZZLE ERROR:", e);
    console.error("CAUSE:", e?.cause); // important
    const details =
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            message: e?.message ?? String(e),
            cause: e?.cause?.message,
            code: e?.cause?.code ?? e?.code,
            detail: e?.cause?.detail ?? e?.detail,
            hint: e?.cause?.hint ?? e?.hint,
          };
    return res.status(500).json({
      error: "Failed to fetch match",
      ...(details ? { details } : {}),
    });
  }
});

matchRouter.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid Payload",
      details: parsed.error.issues(), // nicer than JSON.stringify
    });
  }

  const { startTime, endTime, homeScore, awayScore } = parsed.data;

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime),
      })
      .returning();
    // if (res.app.locals.broadcastMatchCreated) {
    //   res.app.locals.broadcastMatchCreated(event);
    // }

    try {
      const broadcast = res.app.locals.broadcastMatchCreated;
      if (typeof broadcast === "function") {
        broadcast(event);
      }
    } catch (err) {
      console.warn("broadcastMatchCreated failed", err);
    }

    return res.status(201).json({ data: event });
  } catch (e) {
    return res.status(500).json({
      error: "Failed to create match",
      details: e?.message ?? String(e),
    });
  }
});
matchRouter.patch("/:id/score", async (req, res) => {
  const matchId = Number(req.params.id);

  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ error: "Invalid match ID" });
  }

  const { homeScore, awayScore } = req.body;

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    return res
      .status(400)
      .json({ error: "homeScore and awayScore must be integers" });
  }

  try {
    const [updated] = await db
      .update(matches)
      .set({ homeScore, awayScore })
      .where(eq(matches.id, matchId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Match not found" });
    }

    res.status(200).json({ data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update score" });
  }
});
