import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { fieldClass } from '@/components/brand'
import { paymentOptions, type PaymentChannel } from '@/lib/catalog'
import { imageFileToDataUrl } from '@/lib/image-file'
import { peso } from '@/lib/pricing'

/** GCash / MariBank QR, proof-of-payment upload, and last-5 reference digits. */
export function PaymentFields({
  amount,
  channel,
  onChannel,
  proof,
  onProof,
  ref5,
  onRef5,
  errors,
}: {
  amount: number
  channel: PaymentChannel
  onChannel: (c: PaymentChannel) => void
  proof: string | null
  onProof: (p: string | null) => void
  ref5: string
  onRef5: (r: string) => void
  errors?: { proof?: React.ReactNode; ref5?: React.ReactNode }
}) {
  const option = paymentOptions.find((p) => p.id === channel)!
  return (
    <div className="grid gap-5 sm:grid-cols-[13rem_1fr]">
      <div>
        <div
          role="radiogroup"
          aria-label="Payment channel"
          className="grid grid-cols-2 gap-2"
        >
          {paymentOptions.map((p) => (
            <button
              type="button"
              role="radio"
              aria-checked={channel === p.id}
              key={p.id}
              onClick={() => onChannel(p.id)}
              className={`h-10 rounded-lg border text-sm transition ${channel === p.id ? 'border-primary bg-secondary font-medium' : 'bg-card hover:bg-muted'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-xl border bg-white p-2 text-center">
          <img
            src={option.qr}
            alt={`${option.label} QR code`}
            className="mx-auto w-full max-w-56 rounded-lg"
          />
          <a
            href={option.qr}
            download
            className="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline"
          >
            Save QR image
          </a>
        </div>
      </div>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Scan the {channel} QR and send{' '}
          <strong className="text-foreground">{peso(amount)}</strong>, then
          upload your screenshot below.
        </p>
        <label className="block text-sm font-medium">
          Proof of payment <span className="text-primary">*</span>
          <span
            className={`${fieldClass} mt-1 flex cursor-pointer items-center gap-2 font-normal text-muted-foreground`}
          >
            <Upload className="size-4" />{' '}
            {proof ? 'Screenshot attached ✓' : 'Upload screenshot'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return onProof(null)
                try {
                  onProof(await imageFileToDataUrl(f))
                } catch (x) {
                  toast.error(
                    x instanceof Error ? x.message : 'Could not read image',
                  )
                }
              }}
            />
          </span>
          {proof && (
            <img
              src={proof}
              alt="Proof of payment preview"
              className="mt-2 h-24 rounded-lg border object-cover"
            />
          )}
          {errors?.proof}
        </label>
        <label className="block text-sm font-medium">
          Last 5 digits of reference number{' '}
          <span className="text-primary">*</span>
          <input
            inputMode="numeric"
            maxLength={5}
            className={`${fieldClass} mt-1 font-mono tracking-[0.3em]`}
            placeholder="•••••"
            value={ref5}
            onChange={(e) =>
              onRef5(e.target.value.replace(/\D/g, '').slice(0, 5))
            }
          />
          {errors?.ref5}
        </label>
      </div>
    </div>
  )
}
