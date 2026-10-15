import { createHash, timingSafeEqual } from "node:crypto";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { admin, getUser, type User } from "@netlify/identity";
import { z } from "zod";

export const isAdmin = (user: User | null) =>
  !!user &&
  ((user.roles ?? []).includes("admin") ||
    (
      (user.appMetadata?.authorization as { roles?: string[] } | undefined)
        ?.roles ?? []
    ).includes("admin"));

export const getServerUser = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await getUser();
    return user ? { email: user.email, isAdmin: isAdmin(user) } : null;
  },
);

export const requireAdmin = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const user = await getUser();
    if (!isAdmin(user)) throw new Error("Admin access required");
    return next({ context: { user: user! } });
  },
);

const sameSecret = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );

const withAdminRole = (user: User) => {
  const meta = user.appMetadata ?? {};
  const roles = new Set([
    ...((meta.roles as string[] | undefined) ?? []),
    "admin",
  ]);
  return { ...meta, roles: [...roles] };
};

// Runs before sign-in. When the credentials match ADMIN_EMAIL / ADMIN_PASSWORD,
// make sure that Identity account exists, is confirmed, has that password and
// carries the admin role. Any other credentials are left untouched.
export const ensureAdminAccount = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string(), password: z.string() }))
  .handler(async ({ data }) => {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) return;
    if (data.email.trim().toLowerCase() !== adminEmail) return;
    if (!sameSecret(data.password, adminPassword)) return;

    let existing: User | undefined;
    for (let page = 1; !existing; page++) {
      const users = await admin.listUsers({ page, perPage: 100 });
      existing = users.find((u) => u.email?.toLowerCase() === adminEmail);
      if (users.length < 100) break;
    }

    if (!existing) {
      await admin.createUser({
        email: adminEmail,
        password: adminPassword,
        data: { app_metadata: { roles: ["admin"] } },
      });
      return;
    }
    await admin.updateUser(existing.id, {
      password: adminPassword,
      confirm: true,
      app_metadata: withAdminRole(existing),
    });
  });
