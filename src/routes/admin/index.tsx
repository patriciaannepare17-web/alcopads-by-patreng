import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ImagePlus, Loader2, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageTitle, Swatch, fieldClass } from "@/components/brand";
import {
  deleteOnHandProduct,
  listOnHandProducts,
  saveOnHandProduct,
} from "@/lib/admin.functions";
import { imageFileToDataUrl } from "@/lib/image-file";

export const Route = createFileRoute("/admin/")({
  loader: async ({ context }) => ({
    products: context.user?.isAdmin ? await listOnHandProducts() : [],
  }),
  component: ProductsPage,
});

type Product = Awaited<ReturnType<typeof listOnHandProducts>>[number];

function ProductsPage() {
  const { products } = Route.useLoaderData();

  return (
    <>
      <PageTitle eyebrow="Admin" title="On-Hand products">
        Products you add here appear on the homepage and order form. Hidden or
        deleted products are not shown to customers.
      </PageTitle>
      <ProductForm key="new" />
      <div className="mt-8 space-y-3">
        {products.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            No On-Hand products yet. Customers currently see “No On-Hand stocks
            right now”.
          </p>
        ) : (
          products.map((p) => <ProductRow key={p.id} product={p} />)
        )}
      </div>
    </>
  );
}

function ProductRow({ product }: { product: Product }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (editing)
    return <ProductForm product={product} onDone={() => setEditing(false)} />;

  async function remove() {
    if (!confirm(`Delete ${product.name}? Customers will no longer see it.`))
      return;
    setBusy(true);
    try {
      await deleteOnHandProduct({ data: { id: product.id } });
      toast.success(`${product.name} deleted`);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-3">
      <Swatch color={product} className="size-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{product.name}</p>
        <p className="text-sm text-muted-foreground">
          {product.stock} boxes in stock ·{" "}
          {product.visible ? "Shown to customers" : "Hidden"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${product.name}`}
        onClick={() => setEditing(true)}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${product.name}`}
        onClick={remove}
        disabled={busy}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function ProductForm({
  product,
  onDone,
}: {
  product?: Product;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [swatch, setSwatch] = useState(product?.swatch ?? "#f7c6d4");
  const [stock, setStock] = useState(String(product?.stock ?? ""));
  const [visible, setVisible] = useState(product?.visible ?? true);
  const [image, setImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);

  const previewUrl =
    image ?? (removeImage ? null : (product?.imageUrl ?? null));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Enter a product / color name");
    if (!/^\d+$/.test(stock))
      return toast.error("Enter the number of boxes in stock");
    setBusy(true);
    try {
      await saveOnHandProduct({
        data: {
          id: product?.id,
          name,
          swatch,
          stock: Number(stock),
          visible,
          image: image ?? undefined,
          removeImage,
        },
      });
      toast.success(product ? "Product updated" : `${name} added`);
      await router.invalidate();
      if (onDone) onDone();
      else {
        setName("");
        setStock("");
        setImage(null);
        setSwatch("#f7c6d4");
        setVisible(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
        <PackagePlus className="size-5 text-primary" />{" "}
        {product ? `Edit ${product.name}` : "Add On-Hand product"}
      </h2>
      <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
        <label className="cursor-pointer">
          <span className="sr-only">Product photo</span>
          <Swatch
            color={{ name, swatch, imageUrl: previewUrl }}
            className="aspect-square w-28"
          />
          <span className="mt-1 flex items-center gap-1 text-xs text-primary">
            <ImagePlus className="size-3.5" />{" "}
            {previewUrl ? "Change photo" : "Add photo"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setImage(await imageFileToDataUrl(f, 1200));
                setRemoveImage(false);
              } catch (x) {
                toast.error(
                  x instanceof Error ? x.message : "Could not read image",
                );
              }
            }}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium sm:col-span-2">
            Color / design name
            <input
              className={`${fieldClass} mt-1 font-normal`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pink Hearts"
            />
          </label>
          <label className="text-sm font-medium">
            Boxes in stock
            <input
              inputMode="numeric"
              className={`${fieldClass} mt-1 font-normal`}
              value={stock}
              onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label className="text-sm font-medium">
            Swatch color (if no photo)
            <input
              type="color"
              className={`${fieldClass} mt-1 p-1`}
              value={swatch}
              onChange={(e) => setSwatch(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={visible} onCheckedChange={setVisible} /> Show to
            customers
          </label>
          {product?.imageUrl && !image && !removeImage && (
            <button
              type="button"
              className="justify-self-start text-sm text-muted-foreground underline"
              onClick={() => setRemoveImage(true)}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" className="rounded-full" disabled={busy}>
          {busy && (
            <Loader2 className="animate-spin motion-reduce:animate-none" />
          )}{" "}
          {product ? "Save changes" : "Add product"}
        </Button>
        {onDone && (
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={onDone}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
