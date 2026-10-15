ALTER TABLE "orders" ADD COLUMN "email" text;--> statement-breakpoint
CREATE INDEX "orders_email_idx" ON "orders" ("email");