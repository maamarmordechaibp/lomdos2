-- Fix actual_cost to store total cost (per-unit × quantity) instead of per-unit cost.
-- Orders created through OrderCheckout/NewOrder stored per-unit cost in actual_cost,
-- while ReceiveOrders already stored total cost. This migration fixes the inconsistency
-- by multiplying actual_cost × quantity for orders that still have per-unit cost.

-- Fix pending and ordered orders (these were created by OrderCheckout and never
-- went through ReceiveOrders, so actual_cost is still per-unit)
UPDATE customer_orders
SET actual_cost = actual_cost * quantity
WHERE quantity > 1
  AND actual_cost IS NOT NULL
  AND status IN ('pending', 'ordered');

-- Fix orders picked up directly from stock (created by OrderCheckout with status='picked_up',
-- these never go through ReceiveOrders so actual_cost is per-unit)
UPDATE customer_orders
SET actual_cost = actual_cost * quantity
WHERE quantity > 1
  AND actual_cost IS NOT NULL
  AND status = 'picked_up'
  AND notes LIKE '%From Stock%';
