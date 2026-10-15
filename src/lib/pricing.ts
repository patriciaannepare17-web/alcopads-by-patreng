import {
  settings,
  type Category,
  type Region,
  type ShippingMethod,
} from './catalog'

export const peso = (n: number) =>
  '₱' +
  n.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

/** Unit price for a category; Group Buy drops to the bulk price at 200+ boxes. */
export function unitPrice(
  category: Category,
  totalBoxes: number,
  s = settings,
) {
  if (category === 'on-hand') return s.onHandPrice
  return totalBoxes >= s.bulkThreshold ? s.groupBuyBulkPrice : s.groupBuyPrice
}

export type ShippingQuote =
  | { kind: 'fee'; amount: number; label: string }
  | { kind: 'lalamove'; label: string }
  | { kind: 'manual'; label: string }
  | { kind: 'none'; label: string }

/** J&T rates from Pampanga. Each order is quoted on its own box total, so a
 *  Group Buy order never carries an On-Hand order's shipping charge. */
export function shippingQuote(
  method: ShippingMethod | undefined,
  region: Region | undefined,
  boxes: number,
): ShippingQuote {
  if (method === 'Lalamove')
    return {
      kind: 'lalamove',
      label: 'Lalamove — booked & paid by you on pickup',
    }
  if (!method || !region || boxes <= 0)
    return { kind: 'none', label: 'Select region & shipping' }
  if (boxes > 100)
    return { kind: 'manual', label: 'Manual quote — we will message you' }
  const luzon = region === 'Luzon'
  const amount =
    boxes <= 50
      ? luzon
        ? 85
        : 105
      : boxes <= 80
        ? luzon
          ? 130
          : 170
        : luzon
          ? 175
          : 200
  return {
    kind: 'fee',
    amount,
    label: `J&T ${region}, ${boxes} box${boxes === 1 ? '' : 'es'}`,
  }
}

/** OH-YYMMDD-XXXX or <batch>-YYMMDD-XXXX, e.g. GB3-261015-K3F9. */
export function makeOrderNumber(
  category: Category,
  batchCode: string,
  date = new Date(),
) {
  const ymd = new Date(date.getTime() + 8 * 3600_000)
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, '') // Manila date
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const rand = Array.from(
    { length: 4 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('')
  return `${category === 'on-hand' ? 'OH' : batchCode}-${ymd}-${rand}`
}
