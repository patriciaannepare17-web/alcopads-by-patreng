CREATE TABLE "on_hand_products" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"swatch" text DEFAULT '#f7c6d4' NOT NULL,
	"image_key" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY,
	"order_number" text NOT NULL,
	"color" text NOT NULL,
	"product_id" integer,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"order_number" text PRIMARY KEY,
	"whatsapp_name" text NOT NULL,
	"whatsapp_number" text NOT NULL,
	"full_name" text NOT NULL,
	"contact_number" text NOT NULL,
	"region" text NOT NULL,
	"address" text NOT NULL,
	"shipping_method" text NOT NULL,
	"category" text NOT NULL,
	"batch_code" text,
	"status" text NOT NULL,
	"subtotal" integer NOT NULL,
	"shipping_fee" integer,
	"total" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY,
	"order_number" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"channel" text NOT NULL,
	"ref_last5" text NOT NULL,
	"proof_key" text NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_number_orders_order_number_fkey" FOREIGN KEY ("order_number") REFERENCES "orders"("order_number");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_number_orders_order_number_fkey" FOREIGN KEY ("order_number") REFERENCES "orders"("order_number");