import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  Check,
  Copy,
  ImageOff,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  Truck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageTitle, StatusPill, fieldClass } from "@/components/brand";
import {
  listOrders,
  setPaymentConfirmed,
  setShippingFee,
  updateOrderStatus,
  type AdminOrder,
} from "@/lib/admin-orders.functions";
import { formatManila, orderStatuses, type OrderStatus } from "@/lib/catalog";
import { peso } from "@/lib/pricing";

export const Route = createFileRoute("/admin/orders")({
  loader: async ({ context }) => ({
    orders: context.user?.isAdmin ? await listOrders() : [],
  }),
  component: OrdersPage,
});

type Payment = AdminOrder["payments"][number];

const needsAction = (o: AdminOrder) =>
  o.shippingFee === null || o.payments.some((p) => !p.confirmed);

function OrdersPage() {
  const { orders } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all" | "action">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (
        status === "action"
          ? !needsAction(o)
          : status !== "all" && o.status !== status
      )
        return false;
      if (!q) return true;
      return [
        o.orderNumber,
        o.customer.fullName,
        o.customer.contactNumber,
        o.customer.whatsappName,
        o.customer.whatsappNumber,
        o.customer.email ?? "",
        o.shipping.address,
      ].some((v) => v.toLowerCase().includes(q));
    });
  }, [orders, query, status]);

  const toVerify = orders.reduce(
    (n, o) => n + o.payments.filter((p) => !p.confirmed).length,
    0,
  );
  const outstanding = orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((n, o) => n + o.balance, 0);

  return (
    <>
      <PageTitle eyebrow="Admin" title="Orders">
        Customer details, items and payment proofs for every order. Confirm
        payments to update balances — an order turns “Paid” once its balance
        reaches zero.
      </PageTitle>

      <dl className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Payments to verify" value={String(toVerify)} />
        <Stat label="Outstanding balance" value={peso(outstanding)} />
      </dl>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            className={`${fieldClass} pl-9`}
            placeholder="Search order code, name, phone, email or address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="sm:w-60">
          <span className="sr-only">Filter by status</span>
          <select
            className={fieldClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="all">All statuses</option>
            <option value="action">Needs action</option>
            {orderStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          No orders yet. New orders from the order form appear here.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          No orders match your search.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} of {orders.length} orders
          </p>
          {filtered.map((o) => (
            <OrderCard key={o.orderNumber} order={o} />
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold">{value}</dd>
    </div>
  );
}

function OrderCard({ order: o }: { order: AdminOrder }) {
  const boxes = o.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <article className="overflow-hidden rounded-2xl border bg-card">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-secondary/40 px-5 py-3">
        <div className="mr-auto">
          <h2 className="flex items-center gap-2 font-mono text-base font-semibold">
            {o.orderNumber}
            <CopyButton text={o.orderNumber} label="order code" />
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatManila(o.createdAt)} ·{" "}
            {o.category === "group-buy"
              ? `Group Buy${o.batchCode ? ` ${o.batchCode}` : ""}`
              : "On-Hand"}{" "}
            · {boxes} boxes
          </p>
        </div>
        <StatusPill status={o.status} />
        <StatusSelect order={o} />
      </header>

      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.4fr]">
        <section aria-label="Customer and shipping" className="space-y-4">
          <div className="space-y-1.5 text-sm">
            <h3 className="font-display font-semibold">Customer</h3>
            <Detail icon={User}>{o.customer.fullName}</Detail>
            <Detail icon={Phone}>
              <a
                className="underline-offset-2 hover:underline"
                href={`tel:${o.customer.contactNumber}`}
              >
                {o.customer.contactNumber}
              </a>
            </Detail>
            <Detail icon={MessageCircle}>
              {o.customer.whatsappName} · {o.customer.whatsappNumber}
            </Detail>
            {o.customer.email && (
              <p className="pl-6 text-muted-foreground">{o.customer.email}</p>
            )}
          </div>
          <div className="space-y-1.5 text-sm">
            <h3 className="font-display font-semibold">Shipping</h3>
            <Detail icon={Truck}>
              {o.shipping.method === "JNT" ? "J&T" : "Lalamove"} ·{" "}
              {o.shipping.region}
            </Detail>
            <Detail icon={MapPin}>
              <span className="whitespace-pre-line">{o.shipping.address}</span>
              <CopyButton text={o.shipping.address} label="address" />
            </Detail>
          </div>
          <ShippingFeeForm key={o.shippingFee ?? "none"} order={o} />
        </section>

        <section aria-label="Items and payments" className="min-w-0 space-y-4">
          <div>
            <h3 className="mb-2 font-display text-sm font-semibold">Items</h3>
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {o.items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.color}</TableCell>
                      <TableCell className="text-right">{i.quantity}</TableCell>
                      <TableCell className="text-right">
                        {peso(i.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {peso(i.quantity * i.unitPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <SumRow label="Subtotal" value={peso(o.subtotal)} />
                  <SumRow
                    label="Shipping"
                    value={
                      o.shippingFee === null
                        ? "Needs quote"
                        : o.shipping.method === "Lalamove" &&
                            o.shippingFee === 0
                          ? "Lalamove (customer pays)"
                          : peso(o.shippingFee)
                    }
                  />
                  <SumRow label="Total" value={peso(o.total)} strong />
                  <SumRow label="Paid (confirmed)" value={peso(o.paid)} />
                  <SumRow label="Balance" value={peso(o.balance)} strong />
                </TableFooter>
              </Table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-display text-sm font-semibold">
              Payments
            </h3>
            {o.payments.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No payments submitted yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {o.payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    orderNumber={o.orderNumber}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}

function Detail({
  icon: Icon,
  children,
}: {
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span className="flex min-w-0 items-start gap-1">{children}</span>
    </p>
  );
}

function SumRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={3}
        className={
          strong ? "font-semibold" : "font-normal text-muted-foreground"
        }
      >
        {label}
      </TableCell>
      <TableCell
        className={`text-right ${strong ? "font-semibold" : "font-normal"}`}
      >
        {value}
      </TableCell>
    </TableRow>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-primary motion-reduce:transition-none"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success(`Copied ${label}`);
        } catch {
          toast.error("Could not copy");
        }
      }}
    >
      <Copy className="size-3.5" />
    </button>
  );
}

function StatusSelect({ order }: { order: AdminOrder }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(status: OrderStatus) {
    if (
      status === "Cancelled" &&
      !confirm(`Cancel order ${order.orderNumber}?`)
    )
      return;
    setBusy(true);
    try {
      await updateOrderStatus({
        data: { orderNumber: order.orderNumber, status },
      });
      toast.success(`${order.orderNumber} marked ${status}`);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Change status of {order.orderNumber}</span>
      {busy && (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
      )}
      <select
        className={`${fieldClass} h-9 w-44`}
        value={order.status}
        disabled={busy}
        onChange={(e) => change(e.target.value as OrderStatus)}
      >
        {orderStatuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}

function ShippingFeeForm({ order }: { order: AdminOrder }) {
  const router = useRouter();
  const [fee, setFee] = useState(
    order.shippingFee === null ? "" : String(order.shippingFee),
  );
  const [busy, setBusy] = useState(false);
  const unchanged = fee === String(order.shippingFee ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d+$/.test(fee))
      return toast.error("Enter the shipping fee in pesos");
    setBusy(true);
    try {
      await setShippingFee({
        data: { orderNumber: order.orderNumber, shippingFee: Number(fee) },
      });
      toast.success(`Shipping fee saved for ${order.orderNumber}`);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className={`rounded-xl border p-3 ${order.shippingFee === null ? "border-primary bg-accent/40" : ""}`}
    >
      <label
        className="text-sm font-medium"
        htmlFor={`fee-${order.orderNumber}`}
      >
        {order.shippingFee === null
          ? "Shipping quote needed"
          : "Shipping fee (₱)"}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={`fee-${order.orderNumber}`}
          inputMode="numeric"
          className={`${fieldClass} h-9`}
          placeholder="e.g. 450"
          value={fee}
          onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))}
        />
        <Button
          type="submit"
          size="sm"
          className="h-9 rounded-full"
          disabled={busy || unchanged}
        >
          {busy && (
            <Loader2 className="animate-spin motion-reduce:animate-none" />
          )}
          Save
        </Button>
      </div>
    </form>
  );
}

function PaymentRow({
  payment: p,
  orderNumber,
}: {
  payment: Payment;
  orderNumber: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await setPaymentConfirmed({
        data: { id: p.id, confirmed: !p.confirmed },
      });
      toast.success(
        p.confirmed
          ? `${p.kind} marked unconfirmed`
          : `${peso(p.amount)} confirmed for ${orderNumber}`,
      );
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="size-16 shrink-0 overflow-hidden rounded-lg border bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={`View payment proof for ${p.kind}`}
      >
        {broken ? (
          <ImageOff className="m-auto size-5 text-muted-foreground" />
        ) : (
          <img
            src={p.proofUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        )}
      </button>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {p.kind} · {peso(p.amount)}
        </p>
        <p className="text-muted-foreground">
          {p.channel} · Ref ending {p.refLast5}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatManila(p.createdAt)}
        </p>
      </div>
      <Button
        size="sm"
        variant={p.confirmed ? "outline" : "default"}
        className="rounded-full"
        onClick={toggle}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="animate-spin motion-reduce:animate-none" />
        ) : p.confirmed ? (
          <RotateCcw />
        ) : (
          <Check />
        )}
        {p.confirmed ? "Unconfirm" : "Confirm"}
      </Button>
      {p.confirmed && (
        <span className="w-full text-xs font-medium text-primary sm:w-auto">
          Confirmed
        </span>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment proof · {orderNumber}</DialogTitle>
            <DialogDescription>
              {p.kind} of {peso(p.amount)} via {p.channel}, reference ending{" "}
              {p.refLast5}.
            </DialogDescription>
          </DialogHeader>
          {broken ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              This proof image couldn’t be loaded.
            </p>
          ) : (
            <img
              src={p.proofUrl}
              alt={`Payment proof for ${orderNumber}`}
              className="max-h-[70vh] w-full rounded-xl border object-contain"
            />
          )}
          <a
            href={p.proofUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline"
          >
            Open full size in a new tab
          </a>
        </DialogContent>
      </Dialog>
    </li>
  );
}
