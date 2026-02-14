import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";

import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";

import { matchIdParamSchema } from "../validation/matches.js";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

commentaryRouter.post("/", async (req, res) => {
  // 1) Validate params
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Invalid match ID",
      details: parsedParams.error.issues,
    });
  }

  // 2) Validate body
  const parsedBody = createCommentarySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsedBody.error.issues,
    });
  }

  const matchId = parsedParams.data.id;

  try {
    // 3) Insert into DB
    const [created] = await db
      .insert(commentary)
      .values({
        matchId,
        ...parsedBody.data,
      })
      .returning();
    try {
      const broadcast = res.app.locals.broadcastCommentary;
      if (typeof broadcast === "function") {
        broadcast(created.matchId, created);
      }
    } catch (err) {
      console.warn("broadcastCommentary failed", err);
    }

    return res.status(201).json({ data: created });
  } catch (error) {
    console.error("Failed to create commentary:", error);

    return res.status(500).json({
      error: "Failed to create commentary",
      details: error?.message ?? String(error),
    });
  }
});

commentaryRouter.get("/", async (req, res) => {
  /**
   * 1. Validate params
   */
  const parsedParams = matchIdParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Invalid match ID",
      details: parsedParams.error.issues,
    });
  }

  /**
   * 2. Validate query
   */
  const parsedQuery = listCommentaryQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({
      error: "Invalid query parameters",
      details: parsedQuery.error.issues,
    });
  }

  const matchId = parsedParams.data.id;

  /**
   * 3. Apply safe limit
   */
  const limit = Math.min(parsedQuery.data.limit ?? 100, MAX_LIMIT);

  try {
    /**
     * 4. Fetch commentary from DB
     */
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    /**
     * 5. Return response
     */
    return res.status(200).json({
      data,
      meta: {
        count: data.length,
        limit,
      },
    });
  } catch (error) {
    console.error("Failed to fetch commentary:", error);

    return res.status(500).json({
      error: "Failed to fetch commentary",
      details: error?.message ?? String(error),
    });
  }
});
