import { Link } from '@tanstack/react-router'
import { PackageSearch, ShoppingBag, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ColorTile, OrderStatus } from '@/lib/catalog'

export function SiteHeader() {
  const nav = [
    { to: '/order', label: 'Order', icon: ShoppingBag },
    { to: '/track', label: 'Track Order', icon: PackageSearch },
    { to: '/admin', label: 'Admin', icon: ShieldCheck },
  ] as const
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-content items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-baseline gap-1.5">
          <span className="font-display text-lg font-bold tracking-tight text-primary">
            ALCOPADS
          </span>
          <span className="text-xs text-muted-foreground">by Patreng</span>
        </Link>
        <nav className="flex items-center gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              activeProps={{
                className: 'bg-accent !text-accent-foreground font-medium',
              }}
            >
              <Icon className="size-4" />
              <span className="sr-only sm:not-sr-only">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-secondary/50">
      <div className="mx-auto max-w-content px-4 py-8 text-sm text-muted-foreground">
        <p className="font-display text-base text-foreground">
          ALCOPADS by Patreng
        </p>
        <p className="mt-1">
          Ships from Pampanga via J&amp;T or Lalamove · Group Buy downpayments
          are non-refundable
        </p>
      </div>
    </footer>
  )
}

/** Design photo if the admin uploaded one, otherwise a soft color swatch. */
export function Swatch({
  color,
  className,
}: {
  color: ColorTile
  className?: string
}) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-xl border', className)}
      style={{ background: color.swatch }}
    >
      {color.imageUrl ? (
        <img
          src={color.imageUrl}
          alt={color.name}
          className="size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid grid-cols-3 gap-1 p-2 opacity-70">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-md border border-white/70 bg-white/40"
            />
          ))}
        </div>
      )}
    </div>
  )
}

const statusTone: Record<OrderStatus, string> = {
  'Pending Downpayment': 'bg-amber-50 text-amber-700 border-amber-200',
  'Awaiting Payment': 'bg-secondary text-secondary-foreground border-border',
  'Payment Submitted': 'bg-sky-50 text-sky-700 border-sky-200',
  'Manual Quote': 'bg-violet-50 text-violet-700 border-violet-200',
  'Partially Paid': 'bg-sky-50 text-sky-700 border-sky-200',
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Packed: 'bg-pink-50 text-pink-700 border-pink-200',
  Shipped: 'bg-primary text-primary-foreground border-primary',
  Cancelled: 'bg-muted text-muted-foreground border-border line-through',
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        statusTone[status],
      )}
    >
      {status}
    </span>
  )
}

export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {children && (
        <p className="mt-2 max-w-reading text-muted-foreground">{children}</p>
      )}
    </div>
  )
}

export const fieldClass =
  'h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition focus:border-ring focus:ring-[3px] focus:ring-ring/30'
