import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { Loader2, PackageSearch, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  PageTitle,
  SiteFooter,
  SiteHeader,
  StatusPill,
  fieldClass,
} from '@/components/brand'
import { PaymentFields } from '@/components/payment-fields'
import {
  groupBuyColors,
  isBatchOpen,
  settings,
  type PaymentChannel,
} from '@/lib/catalog'
import { peso } from '@/lib/pricing'
import { getStorefront } from '@/lib/store.functions'
import {
  addOrderItems,
  submitPayment,
  trackOrders,
} from '@/lib/track.functions'

export const Route = createFileRoute('/track')({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q:
      typeof s.q === 'string' && s.q.trim()
        ? s.q.trim().slice(0, 200)
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => {
    if (!deps.q) return { orders: null, error: null }
    try {
      return await trackOrders({ data: { query: deps.q } })
    } catch {
      return {
        orders: null,
        error: 'We couldn’t look up your order right now. Please try again.',
      }
    }
  },
  head: () => ({ meta: [{ title: 'Track your order · ALCOPADS by Patreng' }] }),
  component: TrackPage,
})

type TrackedOrder = Awaited<ReturnType<typeof trackOrders>>['orders'][number]

function TrackPage() {
  const { q } = Route.useSearch()
  const { orders, error } = Route.useLoaderData()
  const navigate = useNavigate({ from: '/track' })
  const [query, setQuery] = useState(q ?? '')

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-content px-4 py-8">
        <PageTitle eyebrow="Track order" title="My Orders">
          Enter your order code or the email you used when ordering to see your
          order status and remaining balance.
        </PageTitle>

        <form
          className="flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (query.trim()) navigate({ search: { q: query.trim() } })
          }}
        >
          <label className="sr-only" htmlFor="track-q">
            Order code or email
          </label>
          <input
            id="track-q"
            className={fieldClass}
            placeholder="e.g. GB5-261015-K3F9 or you@email.com"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" className="h-11 rounded-full px-5">
            <Search /> Track
          </Button>
        </form>

        <div className="mt-8 max-w-xl space-y-5">
          {error ? (
            <p
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {error}
            </p>
          ) : orders === null ? null : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <PackageSearch className="mx-auto size-8 text-primary" />
              <p className="mt-2 font-medium">No orders found</p>
              <p className="text-sm text-muted-foreground">
                Check the order code or email and try again.
              </p>
            </div>
          ) : (
            orders.map((o) => <OrderCard key={o.orderNumber} order={o} />)
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function OrderCard({ order: o }: { order: TrackedOrder }) {
  const [dialog, setDialog] = useState<'pay' | 'add' | null>(null)
  const isGB = o.category === 'group-buy'
  const closed = ['Cancelled', 'Shipped', 'Packed'].includes(o.status)
  const canAdd =
    !closed && (!isGB || (o.batchCode === settings.batch.code && isBatchOpen()))
  const batchNo = o.batchCode?.replace(/\D/g, '')

  return (
    <article className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono font-bold tracking-wide">{o.orderNumber}</p>
          <p className="text-sm text-muted-foreground">
            {isGB
              ? `Group Buy · Batch #${batchNo} (${o.batchCode})`
              : 'On-Hand'}{' '}
            ·{' '}
            {new Date(o.createdAt).toLocaleDateString('en-PH', {
              timeZone: 'Asia/Manila',
            })}
          </p>
        </div>
        <StatusPill status={o.status} />
      </div>

      <ul className="mt-4 divide-y rounded-2xl border">
        {o.items.map((i) => (
          <li
            key={i.color}
            className="flex justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <span className="uppercase">{i.color}</span>
            <span className="font-medium">{i.quantity} box(es)</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-1 text-sm">
        <Line label="Subtotal" value={peso(o.subtotal)} />
        <Line
          label={`Shipping (${o.shippingMethod === 'JNT' ? `JNT, ${o.region}` : 'Lalamove'})`}
          value={
            o.shippingFee === null
              ? 'Manual quote — we’ll message you'
              : o.shippingMethod === 'Lalamove'
                ? 'Paid on pickup'
                : peso(o.shippingFee)
          }
        />
        <Line label="Paid (confirmed)" value={peso(o.paid)} />
        {o.pending > 0 && (
          <Line label="Awaiting verification" value={peso(o.pending)} />
        )}
        <div className="flex justify-between gap-3 pt-1 text-base font-bold text-primary">
          <dt>Remaining balance</dt>
          <dd>
            {o.shippingFee === null
              ? `${peso(o.balance)} + SF`
              : peso(o.balance)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="rounded-full"
          disabled={!canAdd}
          onClick={() => setDialog('add')}
        >
          Add items
        </Button>
        <Button
          className="rounded-full"
          disabled={o.due <= 0}
          onClick={() => setDialog('pay')}
        >
          {o.due > 0
            ? `Pay ${peso(o.due)}`
            : o.balance === 0
              ? 'Fully paid'
              : o.shippingFee === null
                ? 'Awaiting quote'
                : 'Payment in review'}
        </Button>
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(v) => !v && setDialog(null)}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          {dialog === 'pay' && (
            <PayForm order={o} onDone={() => setDialog(null)} />
          )}
          {dialog === 'add' && (
            <AddItemsForm order={o} onDone={() => setDialog(null)} />
          )}
        </DialogContent>
      </Dialog>
    </article>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-muted-foreground">
      <dt>{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  )
}

function PayForm({
  order,
  onDone,
}: {
  order: TrackedOrder
  onDone: () => void
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'full' | 'partial'>('full')
  const [partial, setPartial] = useState('')
  const [channel, setChannel] = useState<PaymentChannel>('GCash')
  const [proof, setProof] = useState<string | null>(null)
  const [ref5, setRef5] = useState('')
  const [busy, setBusy] = useState(false)
  const amount = mode === 'full' ? order.due : Number(partial) || 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (amount < 1 || amount > order.due)
      return toast.error(`Enter an amount from ₱1 to ${peso(order.due)}`)
    if (!proof) return toast.error('Upload your proof of payment')
    if (!/^\d{5}$/.test(ref5))
      return toast.error('Enter the last 5 digits of the reference number')
    setBusy(true)
    try {
      await submitPayment({
        data: {
          orderNumber: order.orderNumber,
          amount,
          channel,
          refLast5: ref5,
          proof,
        },
      })
      toast.success('Payment submitted — we’ll verify it shortly')
      await router.invalidate()
      onDone()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Payment could not be submitted',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Pay for {order.orderNumber}</DialogTitle>
        <DialogDescription>
          Remaining balance to pay: {peso(order.due)}. Payments are confirmed
          manually by the admin.
        </DialogDescription>
      </DialogHeader>
      <div
        role="radiogroup"
        aria-label="Amount"
        className="grid grid-cols-2 gap-2"
      >
        {(
          [
            ['full', `Pay full balance · ${peso(order.due)}`],
            ['partial', 'Pay a partial amount'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => setMode(id)}
            className={`rounded-lg border p-3 text-left text-sm transition ${mode === id ? 'border-primary bg-secondary font-medium' : 'bg-card hover:bg-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'partial' && (
        <label className="block text-sm font-medium">
          Amount (₱)
          <input
            inputMode="numeric"
            className={`${fieldClass} mt-1 font-normal`}
            value={partial}
            onChange={(e) => setPartial(e.target.value.replace(/\D/g, ''))}
            placeholder={`Up to ${order.due}`}
          />
        </label>
      )}
      <PaymentFields
        amount={amount}
        channel={channel}
        onChannel={setChannel}
        proof={proof}
        onProof={setProof}
        ref5={ref5}
        onRef5={setRef5}
      />
      <Button type="submit" className="w-full rounded-full" disabled={busy}>
        {busy && (
          <Loader2 className="animate-spin motion-reduce:animate-none" />
        )}{' '}
        Submit payment of {peso(amount)}
      </Button>
    </form>
  )
}

interface AddLine {
  key: number
  id: string
  quantity: string
}

function AddItemsForm({
  order,
  onDone,
}: {
  order: TrackedOrder
  onDone: () => void
}) {
  const router = useRouter()
  const isGB = order.category === 'group-buy'
  const [onHand, setOnHand] = useState<
    Awaited<ReturnType<typeof getStorefront>>['onHand'] | null
  >(isGB ? [] : null)
  const [lines, setLines] = useState<AddLine[]>([
    { key: 1, id: '', quantity: '' },
  ])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isGB) return
    getStorefront()
      .then((s) => setOnHand(s.onHand))
      .catch(() => setOnHand([]))
  }, [isGB])
  const options = isGB
    ? groupBuyColors.map((c) => ({
        id: c.name,
        name: c.name,
        productId: undefined as number | undefined,
        stock: undefined as number | undefined,
      }))
    : (onHand ?? []).map((p) => ({
        id: `p${p.id}`,
        name: p.name,
        productId: p.id as number | undefined,
        stock: p.stock as number | undefined,
      }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const items = lines.map((l) => ({
      o: options.find((x) => x.id === l.id),
      q: Number(l.quantity),
    }))
    if (items.some((i) => !i.o || !Number.isInteger(i.q) || i.q < 1))
      return toast.error('Choose a color and quantity for every line')
    if (new Set(lines.map((l) => l.id)).size !== lines.length)
      return toast.error('Each color can only be added once')
    setBusy(true)
    try {
      await addOrderItems({
        data: {
          orderNumber: order.orderNumber,
          items: items.map((i) => ({
            color: i.o!.name,
            productId: i.o!.productId,
            quantity: i.q,
          })),
        },
      })
      toast.success('Items added to your order')
      await router.invalidate()
      onDone()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Items could not be added',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Add items to {order.orderNumber}</DialogTitle>
        <DialogDescription>
          No minimum quantity when adding. Added items can’t be removed or
          cancelled once submitted.
        </DialogDescription>
      </DialogHeader>
      {onHand === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />{' '}
          Loading colors…
        </p>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No On-Hand stocks are available right now.
        </p>
      ) : (
        <>
          {lines.map((l) => (
            <div key={l.key} className="flex gap-2">
              <select
                aria-label="Color"
                className={fieldClass}
                value={l.id}
                onChange={(e) =>
                  setLines(
                    lines.map((x) =>
                      x.key === l.key ? { ...x, id: e.target.value } : x,
                    ),
                  )
                }
              >
                <option value="">Choose color…</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.stock === 0}>
                    {c.name}
                    {c.stock !== undefined
                      ? ` — ${c.stock ? `${c.stock} left` : 'sold out'}`
                      : ''}
                  </option>
                ))}
              </select>
              <input
                aria-label="Quantity"
                inputMode="numeric"
                className={`${fieldClass} w-24`}
                placeholder="Qty"
                value={l.quantity}
                onChange={(e) =>
                  setLines(
                    lines.map((x) =>
                      x.key === l.key
                        ? { ...x, quantity: e.target.value.replace(/\D/g, '') }
                        : x,
                    ),
                  )
                }
              />
              {lines.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove line"
                  onClick={() => setLines(lines.filter((x) => x.key !== l.key))}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() =>
              setLines([...lines, { key: Date.now(), id: '', quantity: '' }])
            }
          >
            <Plus /> Add another color
          </Button>
          <p className="text-xs text-muted-foreground">
            Your total and shipping fee are recalculated after adding. Pay the
            new balance from this page.
          </p>
          <Button type="submit" className="w-full rounded-full" disabled={busy}>
            {busy && (
              <Loader2 className="animate-spin motion-reduce:animate-none" />
            )}{' '}
            Add to order
          </Button>
        </>
      )}
    </form>
  )
}
