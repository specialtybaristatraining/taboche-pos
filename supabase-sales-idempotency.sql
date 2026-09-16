create unique index if not exists sales_store_order_unique
    on public.sales (store_id, order_number);
