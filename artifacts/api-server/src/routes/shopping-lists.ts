import { createHash, randomBytes } from "node:crypto";
import { getAuth } from "@clerk/express";
import {
  and,
  count,
  eq,
  gt,
  inArray,
  isNull,
} from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  shoppingListInvitesTable,
  shoppingListItemsTable,
  shoppingListMembersTable,
  shoppingListsTable,
} from "@workspace/db";
import {
  AcceptShoppingListInviteBody,
  AcceptShoppingListInviteResponse,
  AddShoppingListItemBody,
  AddShoppingListItemParams,
  AddShoppingListItemResponse,
  ClearCompletedShoppingListItemsParams,
  ClearCompletedShoppingListItemsResponse,
  CreateShoppingListBody,
  CreateShoppingListResponse,
  CreateShoppingListInviteParams,
  CreateShoppingListInviteResponse,
  DeleteShoppingListItemParams,
  GetShoppingListParams,
  GetShoppingListResponse,
  GetShoppingListsResponse,
  UpdateShoppingListBody,
  UpdateShoppingListItemBody,
  UpdateShoppingListItemParams,
  UpdateShoppingListItemResponse,
  UpdateShoppingListParams,
  UpdateShoppingListResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type ListRole = "owner" | "member";

function requireUserId(req: Request, res: Response): string | null {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Cal iniciar sessió." });
    return null;
  }
  return userId;
}

function invalidBody(
  req: Request,
  res: Response,
  error: { message: string },
): void {
  req.log.warn({ validationError: error.message }, "Invalid shopping list input");
  res.status(400).json({ error: error.message });
}

async function getMembership(
  listId: string,
  userId: string,
): Promise<{ role: ListRole } | null> {
  const [membership] = await db
    .select({ role: shoppingListMembersTable.role })
    .from(shoppingListMembersTable)
    .where(
      and(
        eq(shoppingListMembersTable.listId, listId),
        eq(shoppingListMembersTable.userId, userId),
      ),
    )
    .limit(1);

  return membership ? { role: membership.role as ListRole } : null;
}

async function getListForUser(listId: string, userId: string) {
  const membership = await getMembership(listId, userId);
  if (!membership) return null;

  const [list] = await db
    .select()
    .from(shoppingListsTable)
    .where(eq(shoppingListsTable.id, listId))
    .limit(1);
  if (!list) return null;

  const [memberCount] = await db
    .select({ value: count() })
    .from(shoppingListMembersTable)
    .where(eq(shoppingListMembersTable.listId, listId));
  const items = await db
    .select({
      id: shoppingListItemsTable.id,
      productId: shoppingListItemsTable.productId,
      name: shoppingListItemsTable.name,
      category: shoppingListItemsTable.category,
      price: shoppingListItemsTable.price,
      unit: shoppingListItemsTable.unit,
      quantity: shoppingListItemsTable.quantity,
      checked: shoppingListItemsTable.checked,
    })
    .from(shoppingListItemsTable)
    .where(eq(shoppingListItemsTable.listId, listId))
    .orderBy(shoppingListItemsTable.createdAt);

  return {
    id: list.id,
    name: list.name,
    ownerId: list.ownerId,
    role: membership.role,
    memberCount: memberCount?.value ?? 1,
    items,
    updatedAt: list.updatedAt,
  };
}

router.get("/shopping-lists", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const memberships = await db
    .select({
      listId: shoppingListMembersTable.listId,
      role: shoppingListMembersTable.role,
    })
    .from(shoppingListMembersTable)
    .where(eq(shoppingListMembersTable.userId, userId));
  if (!memberships.length) {
    res.json(GetShoppingListsResponse.parse([]));
    return;
  }

  const listIds = memberships.map((membership) => membership.listId);
  const [lists, members, itemCounts] = await Promise.all([
    db
      .select()
      .from(shoppingListsTable)
      .where(inArray(shoppingListsTable.id, listIds)),
    db
      .select({
        listId: shoppingListMembersTable.listId,
        value: count(),
      })
      .from(shoppingListMembersTable)
      .where(inArray(shoppingListMembersTable.listId, listIds))
      .groupBy(shoppingListMembersTable.listId),
    db
      .select({
        listId: shoppingListItemsTable.listId,
        value: count(),
      })
      .from(shoppingListItemsTable)
      .where(inArray(shoppingListItemsTable.listId, listIds))
      .groupBy(shoppingListItemsTable.listId),
  ]);
  const roles = new Map(
    memberships.map((membership) => [membership.listId, membership.role]),
  );
  const memberCounts = new Map(
    members.map((entry) => [entry.listId, entry.value]),
  );
  const itemCountByList = new Map(
    itemCounts.map((entry) => [entry.listId, entry.value]),
  );

  const result = lists.map((list) => ({
    id: list.id,
    name: list.name,
    ownerId: list.ownerId,
    role: roles.get(list.id),
    memberCount: memberCounts.get(list.id) ?? 1,
    itemCount: itemCountByList.get(list.id) ?? 0,
    updatedAt: list.updatedAt,
  }));
  res.json(GetShoppingListsResponse.parse(result));
});

router.post("/shopping-lists", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = CreateShoppingListBody.safeParse(req.body);
  if (!parsed.success) {
    invalidBody(req, res, parsed.error);
    return;
  }
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "El nom de la llista no pot estar buit." });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [list] = await tx
      .insert(shoppingListsTable)
      .values({ name, ownerId: userId })
      .returning();
    await tx.insert(shoppingListMembersTable).values({
      listId: list.id,
      userId,
      role: "owner",
    });
    if (parsed.data.items.length) {
      await tx.insert(shoppingListItemsTable).values(
        parsed.data.items.map((item) => ({ ...item, listId: list.id })),
      );
    }
    return list;
  });

  const result = await getListForUser(created.id, userId);
  if (!result) {
    res.status(500).json({ error: "No s’ha pogut crear la llista." });
    return;
  }
  res.status(201).json(CreateShoppingListResponse.parse(result));
});

router.get("/shopping-lists/:listId", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = GetShoppingListParams.safeParse(req.params);
  if (!params.success) {
    invalidBody(req, res, params.error);
    return;
  }

  const result = await getListForUser(params.data.listId, userId);
  if (!result) {
    res.status(404).json({ error: "No s’ha trobat aquesta llista." });
    return;
  }
  res.json(GetShoppingListResponse.parse(result));
});

router.patch("/shopping-lists/:listId", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = UpdateShoppingListParams.safeParse(req.params);
  if (!params.success) {
    invalidBody(req, res, params.error);
    return;
  }
  const body = UpdateShoppingListBody.safeParse(req.body);
  if (!body.success) {
    invalidBody(req, res, body.error);
    return;
  }
  if (!(await getMembership(params.data.listId, userId))) {
    res.status(404).json({ error: "No s’ha trobat aquesta llista." });
    return;
  }
  const name = body.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "El nom de la llista no pot estar buit." });
    return;
  }

  await db
    .update(shoppingListsTable)
    .set({ name, updatedAt: new Date() })
    .where(eq(shoppingListsTable.id, params.data.listId));
  const result = await getListForUser(params.data.listId, userId);
  if (!result) {
    res.status(404).json({ error: "No s’ha trobat aquesta llista." });
    return;
  }
  res.json(UpdateShoppingListResponse.parse(result));
});

router.post(
  "/shopping-lists/:listId/items",
  async (req, res): Promise<void> => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const params = AddShoppingListItemParams.safeParse(req.params);
    if (!params.success) {
      invalidBody(req, res, params.error);
      return;
    }
    const body = AddShoppingListItemBody.safeParse(req.body);
    if (!body.success) {
      invalidBody(req, res, body.error);
      return;
    }
    if (!(await getMembership(params.data.listId, userId))) {
      res.status(404).json({ error: "No s’ha trobat aquesta llista." });
      return;
    }

    const [item] = await db
      .insert(shoppingListItemsTable)
      .values({ ...body.data, listId: params.data.listId })
      .returning({
        id: shoppingListItemsTable.id,
        productId: shoppingListItemsTable.productId,
        name: shoppingListItemsTable.name,
        category: shoppingListItemsTable.category,
        price: shoppingListItemsTable.price,
        unit: shoppingListItemsTable.unit,
        quantity: shoppingListItemsTable.quantity,
        checked: shoppingListItemsTable.checked,
      });
    await db
      .update(shoppingListsTable)
      .set({ updatedAt: new Date() })
      .where(eq(shoppingListsTable.id, params.data.listId));
    res.status(201).json(AddShoppingListItemResponse.parse(item));
  },
);

router.patch(
  "/shopping-lists/:listId/items/:itemId",
  async (req, res): Promise<void> => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const params = UpdateShoppingListItemParams.safeParse(req.params);
    if (!params.success) {
      invalidBody(req, res, params.error);
      return;
    }
    const body = UpdateShoppingListItemBody.safeParse(req.body);
    if (!body.success) {
      invalidBody(req, res, body.error);
      return;
    }
    if (!(await getMembership(params.data.listId, userId))) {
      res.status(404).json({ error: "No s’ha trobat aquesta llista." });
      return;
    }

    const patch: Partial<typeof shoppingListItemsTable.$inferInsert> = {};
    if (body.data.quantity !== undefined) patch.quantity = body.data.quantity;
    if (body.data.checked !== undefined) patch.checked = body.data.checked;
    if (!Object.keys(patch).length) {
      res.status(400).json({ error: "Cal indicar un canvi per al producte." });
      return;
    }
    const [item] = await db
      .update(shoppingListItemsTable)
      .set(patch)
      .where(
        and(
          eq(shoppingListItemsTable.listId, params.data.listId),
          eq(shoppingListItemsTable.id, params.data.itemId),
        ),
      )
      .returning({
        id: shoppingListItemsTable.id,
        productId: shoppingListItemsTable.productId,
        name: shoppingListItemsTable.name,
        category: shoppingListItemsTable.category,
        price: shoppingListItemsTable.price,
        unit: shoppingListItemsTable.unit,
        quantity: shoppingListItemsTable.quantity,
        checked: shoppingListItemsTable.checked,
      });
    if (!item) {
      res.status(404).json({ error: "No s’ha trobat aquest producte." });
      return;
    }
    await db
      .update(shoppingListsTable)
      .set({ updatedAt: new Date() })
      .where(eq(shoppingListsTable.id, params.data.listId));
    res.json(UpdateShoppingListItemResponse.parse(item));
  },
);

router.delete(
  "/shopping-lists/:listId/items/:itemId",
  async (req, res): Promise<void> => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const params = DeleteShoppingListItemParams.safeParse(req.params);
    if (!params.success) {
      invalidBody(req, res, params.error);
      return;
    }
    if (!(await getMembership(params.data.listId, userId))) {
      res.status(404).json({ error: "No s’ha trobat aquesta llista." });
      return;
    }

    const [item] = await db
      .delete(shoppingListItemsTable)
      .where(
        and(
          eq(shoppingListItemsTable.listId, params.data.listId),
          eq(shoppingListItemsTable.id, params.data.itemId),
        ),
      )
      .returning({ id: shoppingListItemsTable.id });
    if (!item) {
      res.status(404).json({ error: "No s’ha trobat aquest producte." });
      return;
    }
    await db
      .update(shoppingListsTable)
      .set({ updatedAt: new Date() })
      .where(eq(shoppingListsTable.id, params.data.listId));
    res.sendStatus(204);
  },
);

router.post(
  "/shopping-lists/:listId/clear-completed",
  async (req, res): Promise<void> => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const params = ClearCompletedShoppingListItemsParams.safeParse(req.params);
    if (!params.success) {
      invalidBody(req, res, params.error);
      return;
    }
    if (!(await getMembership(params.data.listId, userId))) {
      res.status(404).json({ error: "No s’ha trobat aquesta llista." });
      return;
    }

    const removed = await db
      .delete(shoppingListItemsTable)
      .where(
        and(
          eq(shoppingListItemsTable.listId, params.data.listId),
          eq(shoppingListItemsTable.checked, true),
        ),
      )
      .returning({ id: shoppingListItemsTable.id });
    if (removed.length) {
      await db
        .update(shoppingListsTable)
        .set({ updatedAt: new Date() })
        .where(eq(shoppingListsTable.id, params.data.listId));
    }
    res.json(
      ClearCompletedShoppingListItemsResponse.parse({
        removedCount: removed.length,
      }),
    );
  },
);

router.post(
  "/shopping-lists/:listId/invites",
  async (req, res): Promise<void> => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const params = CreateShoppingListInviteParams.safeParse(req.params);
    if (!params.success) {
      invalidBody(req, res, params.error);
      return;
    }
    if (!(await getMembership(params.data.listId, userId))) {
      res.status(404).json({ error: "No s’ha trobat aquesta llista." });
      return;
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(shoppingListInvitesTable).values({
      tokenHash: createHash("sha256").update(token).digest("hex"),
      listId: params.data.listId,
      createdById: userId,
      expiresAt,
    });
    res
      .status(201)
      .json(CreateShoppingListInviteResponse.parse({ token, expiresAt }));
  },
);

router.post(
  "/shopping-list-invites/accept",
  async (req, res): Promise<void> => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const body = AcceptShoppingListInviteBody.safeParse(req.body);
    if (!body.success) {
      invalidBody(req, res, body.error);
      return;
    }

    const tokenHash = createHash("sha256").update(body.data.token).digest("hex");
    const [invite] = await db
      .select({ listId: shoppingListInvitesTable.listId })
      .from(shoppingListInvitesTable)
      .where(
        and(
          eq(shoppingListInvitesTable.tokenHash, tokenHash),
          gt(shoppingListInvitesTable.expiresAt, new Date()),
          isNull(shoppingListInvitesTable.revokedAt),
        ),
      )
      .limit(1);
    if (!invite) {
      res.status(404).json({ error: "L’enllaç d’invitació ha caducat o no és vàlid." });
      return;
    }

    const existing = await getMembership(invite.listId, userId);
    if (!existing) {
      await db
        .insert(shoppingListMembersTable)
        .values({ listId: invite.listId, userId, role: "member" })
        .onConflictDoNothing();
      await db
        .update(shoppingListsTable)
        .set({ updatedAt: new Date() })
        .where(eq(shoppingListsTable.id, invite.listId));
    }
    const result = await getListForUser(invite.listId, userId);
    if (!result) {
      res.status(404).json({ error: "No s’ha trobat aquesta llista." });
      return;
    }
    res.json(AcceptShoppingListInviteResponse.parse(result));
  },
);

export default router;
