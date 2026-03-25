-- Keep customer order payment state and customer balances in sync

CREATE OR REPLACE FUNCTION public.recalculate_customer_financials(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN;
  END IF;

  -- Recalculate each order's paid amount / balance / payment status from payment ledger
  UPDATE public.customer_orders o
  SET
    amount_paid = GREATEST(0, COALESCE(p.paid_amount, 0)),
    balance_due = GREATEST(0, COALESCE(o.final_price, o.total_amount, 0) - GREATEST(0, COALESCE(p.paid_amount, 0))),
    payment_status = CASE
      WHEN COALESCE(o.final_price, o.total_amount, 0) <= 0 THEN 'paid'
      WHEN GREATEST(0, COALESCE(p.paid_amount, 0)) >= COALESCE(o.final_price, o.total_amount, 0) THEN 'paid'
      WHEN GREATEST(0, COALESCE(p.paid_amount, 0)) > 0 THEN 'partial'
      ELSE 'unpaid'
    END
  FROM (
    SELECT
      cp.order_id,
      SUM(CASE WHEN COALESCE(cp.is_refund, false) THEN -cp.amount ELSE cp.amount END) AS paid_amount
    FROM public.customer_payments cp
    WHERE cp.customer_id = p_customer_id
      AND cp.order_id IS NOT NULL
    GROUP BY cp.order_id
  ) p
  WHERE o.customer_id = p_customer_id
    AND o.id = p.order_id;

  -- Ensure orders with no payments are also normalized
  UPDATE public.customer_orders o
  SET
    amount_paid = 0,
    balance_due = GREATEST(0, COALESCE(o.final_price, o.total_amount, 0)),
    payment_status = CASE
      WHEN COALESCE(o.final_price, o.total_amount, 0) <= 0 THEN 'paid'
      ELSE 'unpaid'
    END
  WHERE o.customer_id = p_customer_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.customer_payments cp
      WHERE cp.customer_id = p_customer_id
        AND cp.order_id = o.id
    );

  -- Recalculate customer outstanding balance from all non-cancelled orders
  UPDATE public.customers c
  SET outstanding_balance = COALESCE((
    SELECT SUM(GREATEST(0, COALESCE(o.final_price, o.total_amount, 0) - COALESCE(o.amount_paid, 0)))
    FROM public.customer_orders o
    WHERE o.customer_id = p_customer_id
      AND o.status <> 'cancelled'
  ), 0)
  WHERE c.id = p_customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_customer_financials_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_customer_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  target_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
  PERFORM public.recalculate_customer_financials(target_customer_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_financials_from_payments ON public.customer_payments;
CREATE TRIGGER trg_sync_customer_financials_from_payments
AFTER INSERT OR UPDATE OR DELETE ON public.customer_payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_financials_trigger();

DROP TRIGGER IF EXISTS trg_sync_customer_financials_from_orders ON public.customer_orders;
CREATE TRIGGER trg_sync_customer_financials_from_orders
AFTER INSERT OR UPDATE OR DELETE ON public.customer_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_financials_trigger();

-- Backfill current data once migration is applied
DO $$
DECLARE
  customer_record RECORD;
BEGIN
  FOR customer_record IN SELECT id FROM public.customers LOOP
    PERFORM public.recalculate_customer_financials(customer_record.id);
  END LOOP;
END $$;
