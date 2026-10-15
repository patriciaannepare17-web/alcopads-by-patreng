import { useEffect } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import {
  Ship,
  Truck,
  PackageCheck,
  Clock3,
  BadgeCheck,
  CalendarClock,
  PackageOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { SiteFooter, SiteHeader, Swatch } from '@/components/brand'
import {
  formatManila,
  groupBuyColors,
  isBatchOpen,
  settings,
} from '@/lib/catalog'
import { peso } from '@/lib/pricing'
import { getStorefront } from '@/lib/store.functions'

export const Route = createFileRoute('/')({
  loader: () => getStorefront(),
  component: Home,
})

function Home() {
  const { onHand, groupBuyTotals } = Route.useLoaderData()
  const router = useRouter()
  const open = isBatchOpen()
  const moq = settings.batch.moqPerColor
  const totalPlaced = groupBuyTotals.reduce((n, t) => n + t.boxes, 0)

  // Keep the tracker live: refresh the counts every 30 seconds while the page is open.
  useEffect(() => {
    const id = setInterval(() => router.invalidate(), 30_000)
    return () => clearInterval(id)
  }, [router])

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden border-b bg-gradient-to-b from-secondary to-background">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="mx-auto max-w-content px-4 py-14 sm:py-20">
          <p className="text-xs font-medium tracking-[0.25em] text-primary uppercase">
            Alcohol pads · Pampanga
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
            ALCOPADS <span className="text-primary italic">by Patreng</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Cute, clean, everyday alcohol pads. Join our Group Buy for the
            sweetest per-box price
            {onHand.length > 0 ? ', or grab ready stocks On-Hand.' : '.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/order" search={{ category: 'group-buy' }}>
                Join {settings.batch.label} Group Buy ·{' '}
                {peso(settings.groupBuyPrice)}/box
              </Link>
            </Button>
            {onHand.length > 0 && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full"
              >
                <Link to="/order" search={{ category: 'on-hand' }}>
                  Order On-Hand · {peso(settings.onHandPrice)}/box
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Group Buy live tracker */}
      <section className="mx-auto mt-6 max-w-content px-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
                {settings.batch.label} Group Buy · live tracker
              </p>
              <p className="mt-1 font-display text-4xl font-bold">
                {totalPlaced.toLocaleString()}{' '}
                <span className="text-lg font-medium text-muted-foreground">
                  boxes placed
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Each color needs at least {moq.toLocaleString()} boxes to push
                through.
              </p>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${open ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}
              >
                {open ? 'Open for orders' : 'Batch closed'}
              </span>
              <p className="flex items-center gap-1.5 text-sm">
                <CalendarClock className="size-4 text-primary" />
                <span>
                  Deadline:{' '}
                  <strong>{formatManila(settings.batch.deadline)}</strong>{' '}
                  (Manila)
                </span>
              </p>
            </div>
          </div>
          <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {groupBuyColors.map((c) => {
              const boxes =
                groupBuyTotals.find((t) => t.color === c.name)?.boxes ?? 0
              const pct = Math.min(100, Math.round((boxes / moq) * 100))
              return (
                <li key={c.name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className="size-3.5 rounded-full border"
                        style={{ background: c.swatch }}
                      />
                      {c.name}
                    </span>
                    <span
                      className={
                        boxes >= moq
                          ? 'font-medium text-emerald-700'
                          : 'text-muted-foreground'
                      }
                    >
                      {boxes >= moq ? '✓ MOQ reached · ' : ''}
                      {boxes.toLocaleString()} / {moq.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    aria-label={`${c.name}: ${boxes} of ${moq} boxes`}
                    className="mt-1.5 h-2 bg-secondary"
                  />
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Catalog */}
      <section className="mx-auto max-w-content px-4 pt-14">
        <div className="grid gap-6 md:grid-cols-2">
          <CategoryCard
            title={`Group Buy · ${settings.batch.label}`}
            price={`${peso(settings.groupBuyPrice)} / box`}
            icon={<Ship className="size-5" />}
            lines={[
              `Bulk ${peso(settings.groupBuyBulkPrice)}/box at ${settings.bulkThreshold}+ total boxes`,
              `Minimum ${settings.groupBuyMinPerColor} boxes per color`,
              `${peso(settings.downpayment)} non-refundable downpayment`,
              'NO ADMIN FEE · INTERNATIONAL SF INCLUDED',
            ]}
            highlight
            cta={
              open ? (
                <Link to="/order" search={{ category: 'group-buy' }}>
                  Join Group Buy
                </Link>
              ) : null
            }
          >
            <div className="grid grid-cols-3 gap-3">
              {groupBuyColors.map((c) => (
                <div key={c.name}>
                  <Swatch color={c} className="aspect-square" />
                  <p className="mt-1.5 text-sm font-medium leading-tight">
                    {c.name}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-3 rounded-xl border border-primary/30 bg-secondary p-4 text-sm">
              <Clock3 className="mt-0.5 size-5 shrink-0 text-primary" />
              <p>
                <strong>Strictly for those willing to wait.</strong> Group Buy
                ships via sea — ETA{' '}
                <strong>end of January to February 2027</strong>. Order
                deadline: {formatManila(settings.batch.deadline)} (Manila).
              </p>
            </div>
          </CategoryCard>

          <CategoryCard
            title="On-Hand"
            price={`${peso(settings.onHandPrice)} / box`}
            icon={<PackageCheck className="size-5" />}
            lines={[
              'Ready to ship from Pampanga',
              'No minimum quantity',
              'No downpayment required',
              'J&T or Lalamove',
            ]}
            cta={
              onHand.length > 0 ? (
                <Link to="/order" search={{ category: 'on-hand' }}>
                  Order On-Hand
                </Link>
              ) : null
            }
          >
            {onHand.length === 0 ? (
              <div className="grid h-full min-h-40 place-items-center rounded-xl border border-dashed p-6 text-center">
                <div>
                  <PackageOpen className="mx-auto size-8 text-primary" />
                  <p className="mt-2 font-medium">
                    No On-Hand stocks right now
                  </p>
                  <p className="text-sm text-muted-foreground">
                    New ready-to-ship colors will appear here once available.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {onHand.map((c) => (
                  <div key={c.id}>
                    <Swatch
                      color={c}
                      className={`aspect-square ${c.stock === 0 ? 'opacity-40 grayscale' : ''}`}
                    />
                    <p className="mt-1.5 text-sm font-medium leading-tight">
                      {c.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.stock ? `${c.stock} boxes left` : 'Sold out'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CategoryCard>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-content px-4 pt-14">
        <h2 className="font-display text-2xl font-bold">How ordering works</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            [
              'Pick your colors',
              'Choose Group Buy or On-Hand, add colors and quantities, and pick J&T or Lalamove.',
            ],
            [
              'Pay via GCash or MariBank',
              `Group Buy needs a ${peso(settings.downpayment)} non-refundable downpayment, deducted from your total. On-Hand needs no downpayment.`,
            ],
            [
              'Get your order number',
              'Keep your order number — we confirm payments manually and message you on WhatsApp.',
            ],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl border bg-card p-5">
              <span className="font-display text-3xl text-primary">
                0{i + 1}
              </span>
              <p className="mt-2 font-medium">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Shipping rates */}
      <section className="mx-auto max-w-content px-4 pt-14">
        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            <h2 className="font-display text-2xl font-bold">
              J&amp;T rates from Pampanga
            </h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Boxes</th>
                  <th className="font-medium">Luzon</th>
                  <th className="font-medium">Visayas / Mindanao</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2">1–50</td>
                  <td>₱85</td>
                  <td>₱105</td>
                </tr>
                <tr>
                  <td className="py-2">51–80</td>
                  <td>₱130</td>
                  <td>₱170</td>
                </tr>
                <tr>
                  <td className="py-2">81–100</td>
                  <td>₱175</td>
                  <td>₱200</td>
                </tr>
                <tr>
                  <td className="py-2">100+</td>
                  <td colSpan={2}>Manual quotation</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            Lalamove is booked and paid by you. Each order is quoted on its own,
            so Group Buy orders never carry On-Hand shipping.
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}

function CategoryCard({
  title,
  price,
  icon,
  lines,
  cta,
  highlight,
  children,
}: {
  title: string
  price: string
  icon: React.ReactNode
  lines: string[]
  cta: React.ReactNode | null
  highlight?: boolean
  children: React.ReactNode
}) {
  return (
    <article
      className={`flex flex-col rounded-2xl border bg-card p-5 sm:p-6 ${highlight ? 'ring-2 ring-primary/25' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary">
            {icon}
            <span className="text-xs font-medium tracking-[0.2em] uppercase">
              {title}
            </span>
          </div>
          <p className="mt-1 font-display text-3xl font-bold">{price}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {lines.map((l) => (
          <li key={l}>· {l}</li>
        ))}
      </ul>
      <div className="mt-5 flex-1">{children}</div>
      {cta && (
        <Button asChild className="mt-6 w-full rounded-full">
          {cta}
        </Button>
      )}
    </article>
  )
}
