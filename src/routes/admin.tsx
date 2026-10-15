import { useState } from "react";
import {
  Link,
  Outlet,
  createFileRoute,
  useRouter,
} from "@tanstack/react-router";
import { AuthError, login, logout } from "@netlify/identity";
import { ClipboardList, Loader2, LogOut, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader, fieldClass } from "@/components/brand";
import { ensureAdminAccount, getServerUser } from "@/lib/auth.functions";

// Layout for every /admin page: signs the admin in, then renders the active tab.
// The user is resolved in beforeLoad so child loaders can skip admin-only queries.
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · ALCOPADS by Patreng" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => ({ user: await getServerUser() }),
  loader: ({ context }) => ({ user: context.user }),
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
] as const;

function AdminLayout() {
  const { user } = Route.useLoaderData();
  const router = useRouter();

  async function signOut() {
    await logout();
    await router.invalidate();
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-content px-4 py-8">
        {!user ? (
          <LoginCard />
        ) : !user.isAdmin ? (
          <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center">
            <h1 className="font-display text-2xl font-bold">Admins only</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {user.email} doesn’t have admin access.
            </p>
            <Button
              variant="outline"
              className="mt-4 rounded-full"
              onClick={signOut}
            >
              <LogOut /> Sign out
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <nav
                aria-label="Admin sections"
                className="inline-flex rounded-full border bg-card p-1"
              >
                {tabs.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    activeOptions={{ exact: true }}
                    className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
                    activeProps={{
                      className:
                        "bg-primary !text-primary-foreground font-medium",
                    }}
                  >
                    <Icon className="size-4" /> {label}
                  </Link>
                ))}
              </nav>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={signOut}
              >
                <LogOut /> Sign out
              </Button>
            </div>
            <Outlet />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function LoginCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await ensureAdminAccount({ data: { email, password } }).catch(() => {});
      await login(email, password);
      await router.invalidate();
    } catch (err) {
      toast.error(
        err instanceof AuthError && err.status === 401
          ? "Invalid email or password."
          : err instanceof Error
            ? err.message
            : "Sign in failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-sm rounded-2xl border bg-card p-6"
    >
      <h1 className="font-display text-2xl font-bold">Admin sign in</h1>
      <label className="mt-4 block text-sm font-medium">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          className={`${fieldClass} mt-1 font-normal`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="mt-3 block text-sm font-medium">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          className={`${fieldClass} mt-1 font-normal`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <Button
        type="submit"
        className="mt-5 w-full rounded-full"
        disabled={busy}
      >
        {busy && (
          <Loader2 className="animate-spin motion-reduce:animate-none" />
        )}{" "}
        Sign in
      </Button>
    </form>
  );
}
