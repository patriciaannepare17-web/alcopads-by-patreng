import { useMemo, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Plus, Trash2, CheckCircle2, Lock, Clock3, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  PageTitle,
  SiteFooter,
  SiteHeader,
  Swatch,
  fieldClass,
} from '@/components/brand'
import {
  formatManila,
  groupBuyColors,
  isBatchOpen,
  settings,
  type Category,
  type ColorTile,
  type PaymentChannel,
  type Region,
  type ShippingMethod,
} from '@/lib/catalog'
import { PaymentFields } from '@/components/payment-fields'
import { peso, shippingQuote, unitPrice } from '@/lib/pricing'
import { createOrder, getStorefront } from '@/lib/store.functions'

export const Route = createFileRoute('/order')({
  validateSearch: (s: Record<string, unknown>): { category?: Category } => ({
    category:
      s.category === 'group-buy'
        ? 'group-buy'
        : s.category === 'on-hand'
          ? 'on-hand'
          : undefined,
  }),
  head: () => ({ meta: [{ title: 'Place an order · ALCOPADS by Patreng' }] }),
  loader: () => getStorefront(),
  component: OrderPage,
})

interface Line {
  key: number
  colorId: string
  quantity: string
}
interface Option extends ColorTile {
  id: string
  productId?: number
  stock?: number
}

const customerFields = [
  ['email', 'Email (for tracking your order)', 'email'],
  ['whatsappName', 'WhatsApp name', 'text'],
  ['whatsappNumber', 'WhatsApp number', 'tel'],
  ['fullName', 'Full name', 'text'],
  ['contactNumber', 'Contact number', 'tel'],
] as const

function OrderPage() {
  const search = Route.useSearch()
  const { onHand } = Route.useLoaderData()
  const router = useRouter()
  const hasOnHand = onHand.length > 0
  const [category, setCategory] = useState<Category>(
    hasOnHand && search.category === 'on-hand' ? 'on-hand' : 'group-buy',
  )
  const [customer, setCustomer] = useState({
    email: '',
    whatsappName: '',
    whatsappNumber: '',
    fullName: '',
    contactNumber: '',
    address: '',
  })
  const [region, setRegion] = useState<Region | ''>('')
  const [method, setMethod] = useState<ShippingMethod | ''>('')
  const [lines, setLines] = useState<Line[]>([
    { key: 1, colorId: '', quantity: '' },
  ])
  const [channel, setChannel] = useState<PaymentChannel>('GCash')
  const [payNow, setPayNow] = useState(false)
  const [plan, setPlan] = useState<'downpayment' | 'full'>('downpayment')
  const [pop, setPop] = useState<string | null>(null)
  const [ref5, setRef5] = useState('')
  const [agree, setAgree] = useState(false)
  const [submitted, setSubmitted] = useState<Awaited<
    ReturnType<typeof createOrder>
  > | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isGB = category === 'group-buy'
  const options: Option[] = isGB
    ? groupBuyColors.map((c) => ({ ...c, id: c.name }))
    : onHand.map((p) => ({ ...p, id: `p${p.id}`, productId: p.id }))
  const gbClosed = isGB && !isBatchOpen()
  // On-Hand needs no downpayment; customers may optionally pay the full amount now.
  const collectPayment = isGB || payNow
  const boxes = lines.reduce((n, l) => n + (Number(l.quantity) || 0), 0)
  const price = unitPrice(category, boxes, settings)
  const subtotal = boxes * price
  const ship = shippingQuote(method || undefined, region || undefined, boxes)
  const shipping = ship.kind === 'fee' ? ship.amount : 0
  const total = subtotal + shipping
  const canPayFull = ship.kind === 'fee' || ship.kind === 'lalamove'
  // Group Buy: downpayment or full. On-Hand: full only (no downpayment needed).
  const effectivePlan =
    isGB && plan === 'full' && canPayFull
      ? 'full'
      : isGB
        ? 'downpayment'
        : 'full'
  const payAmount =
    effectivePlan === 'full'
      ? total
      : Math.min(settings.downpayment, total || settings.downpayment)

  const lineErrors = useMemo(
    () =>
      lines.map((l) => {
        const q = Number(l.quantity)
        const color = options.find((c) => c.id === l.colorId)
        if (!l.colorId) return 'Choose a color'
        if (!Number.isInteger(q) || q < 1) return 'Enter a quantity'
        if (category === 'group-buy' && q < settings.groupBuyMinPerColor)
          return `Minimum ${settings.groupBuyMinPerColor} boxes per color`
        if (
          category === 'on-hand' &&
          color?.stock !== undefined &&
          q > color.stock
        )
          return `Only ${color.stock} boxes left`
        if (lines.filter((x) => x.colorId === l.colorId).length > 1)
          return 'Color already added'
        return null
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, category, onHand],
  )

  const errors: Record<string, string | null> = {
    ...Object.fromEntries(
      customerFields.map(([k, label]) => [
        k,
        customer[k].trim() ? null : `${label} is required`,
      ]),
    ),
    whatsappNumber: /^\+?[0-9 ]{10,15}$/.test(customer.whatsappNumber.trim())
      ? null
      : 'Enter a valid WhatsApp number',
    contactNumber: /^\+?[0-9 ]{10,15}$/.test(customer.contactNumber.trim())
      ? null
      : 'Enter a valid contact number',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())
      ? null
      : 'Enter a valid email',
    region: region ? null : 'Select your region',
    address:
      /barangay|brgy/i.test(customer.address) &&
      customer.address.trim().length > 15
        ? null
        : 'Complete address must include your barangay',
    method: method ? null : 'Choose J&T or Lalamove',
    pop: !collectPayment || pop ? null : 'Upload your proof of payment',
    ref5:
      !collectPayment || /^\d{5}$/.test(ref5) ? null : 'Enter exactly 5 digits',
    payNow:
      payNow && ship.kind === 'manual'
        ? 'Please wait for your shipping quote before paying'
        : null,
    agree: agree ? null : 'Please acknowledge the order policy',
  }
  const valid =
    !gbClosed &&
    Object.values(errors).every((e) => !e) &&
    lineErrors.every((e) => !e)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setShowErrors(true)
    if (!valid) return toast.error('Please complete the highlighted fields')
    setSubmitting(true)
    try {
      const result = await createOrder({
        data: {
          category,
          email: customer.email,
          whatsappName: customer.whatsappName,
          whatsappNumber: customer.whatsappNumber,
          fullName: customer.fullName,
          contactNumber: customer.contactNumber,
          region: region as Region,
          address: customer.address,
          shippingMethod: method as ShippingMethod,
          items: lines.map((l) => {
            const o = options.find((x) => x.id === l.colorId)!
            return {
              color: o.name,
              productId: o.productId,
              quantity: Number(l.quantity),
            }
          }),
          payment:
            collectPayment && pop
              ? { channel, refLast5: ref5, proof: pop, plan: effectivePlan }
              : undefined,
          agree: true,
        },
      })
      setSubmitted(result)
      router.invalidate()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Your order could not be submitted. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const err = (k: string) =>
    showErrors && errors[k] ? (
      <p className="mt-1 text-xs text-destructive">{errors[k]}</p>
    ) : null

  if (submitted) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-primary" />
          <h1 className="mt-4 font-display text-3xl font-bold">
            Order received!
          </h1>
          <p className="mt-2 text-muted-foreground">Your order number</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-primary">
            {submitted.orderNumber}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {isGB && effectivePlan === 'full' ? (
              <>
                We’ll verify your full payment of{' '}
                <strong className="text-foreground">
                  {peso(submitted.total)}
                </strong>{' '}
                shortly.
              </>
            ) : isGB ? (
              <>
                We’ll verify your {peso(settings.downpayment)} downpayment
                shortly. Remaining balance:{' '}
                <strong className="text-foreground">
                  {submitted.shippingKnown
                    ? peso(Math.max(0, submitted.total - settings.downpayment))
                    : 'pending a shipping quote'}
                </strong>
                . You can settle it anytime from Track Order.
              </>
            ) : submitted.status === 'Payment Submitted' ? (
              <>
                We’ll verify your payment of{' '}
                <strong className="text-foreground">
                  {peso(submitted.total)}
                </strong>{' '}
                shortly.
              </>
            ) : submitted.shippingKnown ? (
              <>
                Your total is{' '}
                <strong className="text-foreground">
                  {peso(submitted.total)}
                </strong>
                . We’ll message you on WhatsApp to arrange payment.
              </>
            ) : (
              <>
                We’ll message you on WhatsApp with your shipping quote before
                you pay.
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Please screenshot or save your order number. You can track it
            anytime from Track Order using this code or your email.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link to="/track" search={{ q: submitted.orderNumber }}>
              Track my order
            </Link>
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <PageTitle eyebrow="New order" title="Place your order">
        All customer details are required. Submitted colors and quantities are
        locked — you can add more items later under the same order number.
      </PageTitle>

      <form
        onSubmit={submit}
        noValidate
        className="grid gap-6 lg:grid-cols-[1fr_22rem]"
      >
        <div className="space-y-6">
          {/* Category */}
          <Section title="1 · Category">
            <div className="grid grid-cols-2 gap-3">
              {(['group-buy', 'on-hand'] as const).map((c) => {
                const disabled = c === 'on-hand' && !hasOnHand
                return (
                  <button
                    type="button"
                    key={c}
                    disabled={disabled}
                    onClick={() => {
                      setCategory(c)
                      setPayNow(false)
                      setLines([{ key: Date.now(), colorId: '', quantity: '' }])
                    }}
                    className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${category === c ? 'border-primary bg-secondary ring-2 ring-primary/20' : 'bg-card hover:bg-muted'}`}
                  >
                    <p className="font-medium">
                      {c === 'on-hand'
                        ? 'On-Hand'
                        : `Group Buy · ${settings.batch.label}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {c === 'on-hand'
                        ? hasOnHand
                          ? `${peso(settings.onHandPrice)}/box · no minimum · no downpayment`
                          : 'No stocks available right now'
                        : `${peso(settings.groupBuyPrice)}/box · ${peso(settings.groupBuyBulkPrice)} at ${settings.bulkThreshold}+`}
                    </p>
                  </button>
                )
              })}
            </div>
            {isGB && (
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex gap-2">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    Order deadline:{' '}
                    <strong>{formatManila(settings.batch.deadline)}</strong>{' '}
                    (Manila time). Each color needs{' '}
                    {settings.batch.moqPerColor.toLocaleString()} boxes in total
                    to push through.
                  </span>
                </p>
                <p className="rounded-lg bg-secondary px-3 py-2 font-medium text-secondary-foreground">
                  NO ADMIN FEE · INTERNATIONAL SF INCLUDED IN GROUP BUY PRICE
                </p>
                <p className="text-muted-foreground">
                  Strictly for those willing to wait — shipped via sea, ETA end
                  of January–February 2027.
                </p>
                {gbClosed && (
                  <p className="flex gap-2 font-medium text-destructive">
                    <Lock className="size-4" />
                    This batch is closed. New Group Buy orders are not accepted.
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* Items */}
          <Section title="2 · Colors & quantity">
            <div className="space-y-3">
              {lines.map((l, i) => {
                const color = options.find((c) => c.id === l.colorId)
                return (
                  <div
                    key={l.key}
                    className="rounded-xl border bg-background p-3"
                  >
                    <div className="flex gap-3">
                      {color ? (
                        <Swatch color={color} className="size-16 shrink-0" />
                      ) : (
                        <div className="size-16 shrink-0 rounded-xl border border-dashed" />
                      )}
                      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_7rem]">
                        <select
                          className={fieldClass}
                          value={l.colorId}
                          onChange={(e) =>
                            setLines(
                              lines.map((x) =>
                                x.key === l.key
                                  ? { ...x, colorId: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        >
                          <option value="">Choose color…</option>
                          {options.map((c) => (
                            <option
                              key={c.id}
                              value={c.id}
                              disabled={c.stock === 0}
                            >
                              {c.name}
                              {c.stock !== undefined
                                ? ` — ${c.stock ? `${c.stock} left` : 'sold out'}`
                                : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          className={fieldClass}
                          inputMode="numeric"
                          placeholder={
                            category === 'group-buy'
                              ? `Min ${settings.groupBuyMinPerColor}`
                              : 'Qty'
                          }
                          value={l.quantity}
                          onChange={(e) =>
                            setLines(
                              lines.map((x) =>
                                x.key === l.key
                                  ? {
                                      ...x,
                                      quantity: e.target.value.replace(
                                        /\D/g,
                                        '',
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove line"
                          onClick={() =>
                            setLines(lines.filter((x) => x.key !== l.key))
                          }
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                    {showErrors && lineErrors[i] && (
                      <p className="mt-2 text-xs text-destructive">
                        {lineErrors[i]}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3 rounded-full"
              onClick={() =>
                setLines([
                  ...lines,
                  { key: Date.now(), colorId: '', quantity: '' },
                ])
              }
            >
              <Plus /> Add another color
            </Button>
          </Section>

          {/* Customer */}
          <Section title="3 · Customer details">
            <div className="grid gap-4 sm:grid-cols-2">
              {customerFields.map(([k, label, type]) => (
                <label key={k} className="text-sm font-medium">
                  {label} <span className="text-primary">*</span>
                  <input
                    type={type}
                    className={`${fieldClass} mt-1 font-normal`}
                    value={customer[k]}
                    onChange={(e) =>
                      setCustomer({ ...customer, [k]: e.target.value })
                    }
                  />
                  {err(k)}
                </label>
              ))}
              <label className="text-sm font-medium">
                Region <span className="text-primary">*</span>
                <select
                  className={`${fieldClass} mt-1 font-normal`}
                  value={region}
                  onChange={(e) => setRegion(e.target.value as Region)}
                >
                  <option value="">Select region…</option>
                  <option>Luzon</option>
                  <option>Visayas</option>
                  <option>Mindanao</option>
                </select>
                {err('region')}
              </label>
              <div className="text-sm font-medium">
                Shipping method <span className="text-primary">*</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(['JNT', 'Lalamove'] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`h-11 rounded-lg border text-sm font-normal transition ${method === m ? 'border-primary bg-secondary font-medium' : 'bg-card hover:bg-muted'}`}
                    >
                      {m === 'JNT' ? 'J&T Express' : 'Lalamove'}
                    </button>
                  ))}
                </div>
                {err('method')}
              </div>
              <label className="text-sm font-medium sm:col-span-2">
                Complete address (house no., street, barangay, city, province){' '}
                <span className="text-primary">*</span>
                <textarea
                  rows={3}
                  className={`${fieldClass} mt-1 h-auto py-2 font-normal`}
                  placeholder="e.g. 12 Mabini St., Brgy. San Jose, Angeles City, Pampanga"
                  value={customer.address}
                  onChange={(e) =>
                    setCustomer({ ...customer, address: e.target.value })
                  }
                />
                {err('address')}
              </label>
            </div>
          </Section>

          {/* Payment */}
          <Section
            title={
              isGB
                ? `4 · Payment (${peso(settings.downpayment)} downpayment or full)`
                : '4 · Payment'
            }
          >
            {!isGB && (
              <div className="mb-4 space-y-3">
                <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
                  No downpayment required for On-Hand orders.
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={payNow}
                    onCheckedChange={(v) => setPayNow(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    I’d like to pay the full amount now
                    {ship.kind === 'fee' || ship.kind === 'lalamove'
                      ? ` (${peso(total)})`
                      : ''}{' '}
                    and upload my proof of payment.
                  </span>
                </label>
                {err('payNow')}
              </div>
            )}
            {isGB && (
              <div
                role="radiogroup"
                aria-label="Payment plan"
                className="mb-4 grid gap-2 sm:grid-cols-2"
              >
                {(
                  [
                    [
                      'downpayment',
                      `Downpayment only · ${peso(settings.downpayment)}`,
                      'Settle the remaining balance later from Track Order.',
                    ],
                    [
                      'full',
                      `Pay in full${canPayFull ? ` · ${peso(total)}` : ''}`,
                      canPayFull
                        ? 'Pay the whole order now.'
                        : 'Available once your shipping fee is known.',
                    ],
                  ] as const
                ).map(([id, label, hint]) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={plan === id}
                    key={id}
                    disabled={id === 'full' && !canPayFull}
                    onClick={() => setPlan(id)}
                    className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${plan === id ? 'border-primary bg-secondary ring-2 ring-primary/20' : 'bg-card hover:bg-muted'}`}
                  >
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </button>
                ))}
              </div>
            )}
            {collectPayment && (
              <PaymentFields
                amount={payAmount}
                channel={channel}
                onChannel={setChannel}
                proof={pop}
                onProof={setPop}
                ref5={ref5}
                onRef5={setRef5}
                errors={{ proof: err('pop'), ref5: err('ref5') }}
              />
            )}
            <label className="mt-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-secondary p-3 text-sm">
              <Checkbox
                checked={agree}
                onCheckedChange={(v) => setAgree(v === true)}
                className="mt-0.5"
              />
              <span>
                {isGB ? (
                  <>
                    I understand the {peso(settings.downpayment)} downpayment is{' '}
                    <strong>non-refundable</strong> and is deducted from my
                    final balance, and that unpaid orders past the deadline may
                    be cancelled. Submitted items cannot be cancelled.
                  </>
                ) : (
                  <>
                    I understand that submitted items cannot be cancelled and
                    that unpaid orders may be cancelled.
                  </>
                )}
              </span>
            </label>
            {err('agree')}
          </Section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-xl font-bold">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row
                label={`${boxes} box${boxes === 1 ? '' : 'es'} × ${peso(price)}`}
                value={peso(subtotal)}
              />
              {category === 'group-buy' &&
                boxes > 0 &&
                boxes < settings.bulkThreshold && (
                  <p className="text-xs text-muted-foreground">
                    Add {settings.bulkThreshold - boxes} more to unlock{' '}
                    {peso(settings.groupBuyBulkPrice)}/box
                  </p>
                )}
              <Row
                label="Shipping"
                value={
                  ship.kind === 'fee'
                    ? peso(ship.amount)
                    : ship.kind === 'manual'
                      ? 'Manual quote'
                      : ship.kind === 'lalamove'
                        ? '—'
                        : '—'
                }
              />
              <p className="text-xs text-muted-foreground">{ship.label}</p>
              <div className="border-t pt-2">
                <Row
                  label="Total"
                  value={
                    ship.kind === 'manual'
                      ? `${peso(subtotal)} + SF`
                      : peso(total)
                  }
                  strong
                />
              </div>
              {isGB && effectivePlan === 'full' && (
                <Row label="Paying today" value={peso(total)} strong />
              )}
              {isGB && effectivePlan === 'downpayment' && (
                <>
                  <Row
                    label="Downpayment today"
                    value={`− ${peso(settings.downpayment)}`}
                  />
                  <Row
                    label="Balance to settle later"
                    value={
                      ship.kind === 'manual'
                        ? `${peso(Math.max(0, subtotal - settings.downpayment))} + SF`
                        : peso(Math.max(0, total - settings.downpayment))
                    }
                    strong
                  />
                </>
              )}
              {!isGB && <Row label="Downpayment" value="None required" />}
            </dl>
            <Button
              type="submit"
              size="lg"
              className="mt-5 w-full rounded-full"
              disabled={gbClosed || submitting}
            >
              {submitting && (
                <Loader2 className="animate-spin motion-reduce:animate-none" />
              )}
              {submitting
                ? 'Submitting…'
                : gbClosed
                  ? 'Batch closed'
                  : 'Submit order'}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Ships from Pampanga
            </p>
          </div>
        </aside>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-content px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-4 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}

function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
    >
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}
