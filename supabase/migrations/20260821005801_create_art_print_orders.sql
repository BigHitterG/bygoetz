create table public.art_print_orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  print_slug text not null,
  print_title text not null,
  quantity smallint not null,
  currency text not null,
  subtotal_amount integer not null,
  shipping_amount integer not null default 0,
  tax_amount integer not null default 0,
  total_amount integer not null,
  buyer_email text,
  buyer_name text,
  shipping_name text,
  shipping_address jsonb,
  fulfillment_status text not null default 'paid',
  notification_status text not null default 'pending',
  customer_notified_at timestamptz,
  owner_notified_at timestamptz,
  customer_email_id text,
  owner_email_id text,
  notification_error text,
  paid_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint art_print_orders_stripe_session_check
    check (
      length(stripe_session_id) between 12 and 255
      and stripe_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$'
    ),
  constraint art_print_orders_payment_intent_check
    check (
      stripe_payment_intent_id is null
      or (
        length(stripe_payment_intent_id) between 10 and 255
        and stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'
      )
    ),
  constraint art_print_orders_customer_check
    check (
      stripe_customer_id is null
      or (
        length(stripe_customer_id) between 10 and 255
        and stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'
      )
    ),
  constraint art_print_orders_slug_check
    check (
      length(print_slug) between 1 and 100
      and print_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint art_print_orders_title_check
    check (length(print_title) between 1 and 200),
  constraint art_print_orders_quantity_check
    check (quantity between 1 and 10),
  constraint art_print_orders_currency_check
    check (currency ~ '^[a-z]{3}$'),
  constraint art_print_orders_amounts_check
    check (
      subtotal_amount >= 0
      and shipping_amount >= 0
      and tax_amount >= 0
      and total_amount >= subtotal_amount
    ),
  constraint art_print_orders_email_check
    check (buyer_email is null or length(buyer_email) between 3 and 254),
  constraint art_print_orders_names_check
    check (
      (buyer_name is null or length(buyer_name) between 1 and 200)
      and (shipping_name is null or length(shipping_name) between 1 and 200)
    ),
  constraint art_print_orders_address_check
    check (
      shipping_address is null
      or (
        jsonb_typeof(shipping_address) = 'object'
        and pg_column_size(shipping_address) <= 8192
      )
    ),
  constraint art_print_orders_fulfillment_status_check
    check (
      fulfillment_status in ('paid', 'preparing', 'shipped', 'cancelled', 'refunded')
    ),
  constraint art_print_orders_notification_status_check
    check (notification_status in ('pending', 'sent', 'partial', 'failed', 'skipped')),
  constraint art_print_orders_notification_error_check
    check (notification_error is null or length(notification_error) <= 500)
);

comment on table public.art_print_orders is
  'Private, server-only fulfillment ledger for physical art-print purchases completed through Stripe Checkout.';

comment on column public.art_print_orders.shipping_address is
  'Private shipping address supplied by Stripe Checkout. Never exposed to anon or authenticated Data API roles.';

create index art_print_orders_created_idx
  on public.art_print_orders (created_at desc);

create index art_print_orders_fulfillment_idx
  on public.art_print_orders (fulfillment_status, created_at desc);

alter table public.art_print_orders enable row level security;

revoke all on table public.art_print_orders from public, anon, authenticated;
grant select, insert, update on table public.art_print_orders to service_role;
