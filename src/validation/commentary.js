// src/validation/commentary.js
import { z } from "zod";

/**
 * Query schema for listing commentary
 * Example: GET /commentary?limit=50
 */
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * Schema for creating a commentary event
 * Used in POST /commentary
 */
export const createCommentarySchema = z.object({
  /**
   * Match minute (0, 1, 2, ..., 120)
   */
  minute: z.coerce.number().int().min(0),

  /**
   * Sequence number for ordering events occurring in the same minute
   */
  sequence: z.coerce.number().int().min(0),

  /**
   * Period of play
   * Examples: "1H", "2H", "ET", "FT", "HT"
   */
  period: z.string().min(1),

  /**
   * Event type
   * Examples: "goal", "foul", "card", "substitution"
   */
  eventType: z.string().min(1),

  /**
   * Actor performing the action
   * Example: "Lionel Messi"
   */
  actor: z.string().min(1),

  /**
   * Team name or identifier
   * Example: "Inter Miami"
   */
  team: z.string().min(1),

  /**
   * Human-readable commentary message
   */
  message: z.string().min(1),

  /**
   * Flexible metadata object for structured details
   * Example:
   * {
   *   playerId: "uuid",
   *   assistBy: "player name"
   * }
   */
  metadata: z.record(z.string(), z.any()).default({}),

  /**
   * Tags for filtering / indexing
   * Example: ["goal", "highlight"]
   */

  tags: z.array(z.string()).default([]),
});
