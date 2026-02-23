import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, integer, boolean, text } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  username: text("username"),
  displayName: text("display_name"),
  bio: text("bio"),
  auraLevel: integer("aura_level").default(1).notNull(),
  energyPoints: integer("energy_points").default(100).notNull(),
  dominantChakra: text("dominant_chakra"),
  spiritualPath: text("spiritual_path"),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  spiritName: text("spirit_name"),
  spiritDescription: text("spirit_description"),
  spiritImageUrl: text("spirit_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
