import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const shoppingListsTable = pgTable("shopping_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const shoppingListMembersTable = pgTable(
  "shopping_list_members",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingListsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.listId, table.userId] }),
    userIdx: index("shopping_list_members_user_idx").on(table.userId),
  }),
);

export const shoppingListItemsTable = pgTable(
  "shopping_list_items",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingListsTable.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    productId: text("product_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    price: numeric("price", { precision: 10, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    unit: text("unit").notNull(),
    quantity: integer("quantity").notNull().default(1),
    checked: boolean("checked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.listId, table.id] }),
    listIdx: index("shopping_list_items_list_idx").on(table.listId),
  }),
);

export const shoppingListInvitesTable = pgTable(
  "shopping_list_invites",
  {
    tokenHash: text("token_hash").primaryKey(),
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingListsTable.id, { onDelete: "cascade" }),
    createdById: text("created_by_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    listIdx: index("shopping_list_invites_list_idx").on(table.listId),
  }),
);
