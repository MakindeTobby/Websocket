// src/db/schema.js
import {
  pgEnum,
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Enums
 * - Variable names are camelCase
 * - DB identifiers (enum/table/column) are snake_case
 */
export const matchStatus = pgEnum("match_status", [
  "scheduled",
  "live",
  "finished",
]);

/**
 * matches
 * Notes:
 * - startTime/endTime are timestamptz to avoid timezone ambiguity in real-time apps
 * - scores default to 0
 * - createdAt defaults to now()
 */
export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),

    sport: varchar("sport", { length: 50 }).notNull(),

    homeTeam: varchar("home_team", { length: 120 }).notNull(),
    awayTeam: varchar("away_team", { length: 120 }).notNull(),

    status: matchStatus("status").notNull().default("scheduled"),

    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),

    homeScore: integer("home_score").notNull().default(0),
    awayScore: integer("away_score").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index("matches_status_idx").on(t.status),
    startTimeIdx: index("matches_start_time_idx").on(t.startTime),
    sportIdx: index("matches_sport_idx").on(t.sport),
  }),
);

/**
 * commentary
 * Notes:
 * - matchId references matches.id
 * - (matchId, sequence) is unique so clients can apply events idempotently and keep ordering stable
 * - metadata is jsonb for flexible event payloads
 * - tags stored as text (commonly comma-separated or space-delimited); if you want true arrays, use pgArray/text[]
 */
export const commentary = pgTable(
  "commentary",
  {
    id: serial("id").primaryKey(),

    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    minute: integer("minute").notNull(),
    sequence: integer("sequence").notNull(),

    // e.g. "1H", "2H", "OT", "PEN", etc.
    period: varchar("period", { length: 16 }),

    // e.g. "goal", "yellow_card", "substitution", "kickoff", "full_time"
    eventType: varchar("event_type", { length: 64 }).notNull(),

    // e.g. player name, referee, system, etc.
    actor: varchar("actor", { length: 120 }),

    // e.g. "home" | "away" or actual team name/identifier (left flexible)
    team: varchar("team", { length: 120 }),

    message: text("message").notNull(),

    // metadata:
    //   jsonb("metadata").$type?.(/* optional typing hook for TS users */ null) ??
    //   jsonb("metadata"),

    metadata: jsonb("metadata").notNull().default({}),

    // free-form tags, keep flexible for now
    // tags: text("tags"),
    tags: text("tags").array().notNull().default([]),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    matchIdIdx: index("commentary_match_id_idx").on(t.matchId),
    matchOrderIdx: index("commentary_match_id_sequence_idx").on(
      t.matchId,
      t.sequence,
    ),
    matchSequenceUnique: uniqueIndex("commentary_match_id_sequence_unique").on(
      t.matchId,
      t.sequence,
    ),
  }),
);
