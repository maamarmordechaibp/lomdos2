export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notification_preference: 'phone' | 'email';
  outstanding_balance: number;
  store_credit: number;
  default_discount_type: 'percentage' | 'fixed' | null;
  default_discount_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  outstanding_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  title: string;
  title_hebrew: string | null;
  author: string | null;
  isbn: string | null;
  category: string | null;
  subcategory: string | null;
  cover_image_url: string | null;
  current_supplier_id: string | null;
  default_cost: number | null;
  no_profit: boolean;
  custom_profit_margin: number | null;
  fixed_discount: number | null;
  discount_type: 'percentage' | 'fixed';
  quantity_in_stock: number;
  low_stock_threshold: number;
  reorder_quantity: number;
  created_at: string;
  updated_at: string;
  // Joined data
  current_supplier?: Supplier;
}

export interface BookSupplierHistory {
  id: string;
  book_id: string;
  supplier_id: string;
  last_ordered_at: string;
  last_cost: number | null;
  is_active: boolean;
  created_at: string;
}

export interface GlobalSettings {
  id: string;
  store_name: string;
  store_logo_url: string | null;
  favicon_url: string | null;
  store_cell_phone: string | null;
  default_profit_margin: number;
  currency: string;
  signalwire_space_url: string | null;
  signalwire_project_id: string | null;
  signalwire_api_token: string | null;
  // Sola payment settings (iFields key is PUBLIC, safe for frontend)
  // API key is stored as Edge Function secret (SOLA_API_KEY)
  sola_ifields_key: string | null;
  sola_software_name: string | null;
  sola_software_version: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'pay_at_pickup';
export type OrderPaymentMethod = 'cash' | 'card' | 'check' | 'mixed' | null;

export interface CustomerOrder {
  id: string;
  customer_id: string;
  book_id: string;
  quantity: number;
  status: 'pending' | 'ordered' | 'received' | 'ready' | 'picked_up' | 'cancelled';
  payment_status: PaymentStatus;
  payment_method: OrderPaymentMethod;
  deposit_amount: number;
  final_price: number | null;
  actual_cost: number | null;
  amount_paid: number;
  total_amount: number | null;
  balance_due: number | null;
  is_bill: boolean;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  discount_reason: string | null;
  original_price: number | null;
  picked_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  customer?: Customer;
  book?: Book;
  items?: CustomerOrderItem[];
}

export interface CustomerOrderItem {
  id: string;
  order_id: string;
  book_id: string;
  quantity: number;
  unit_price: number | null;
  unit_cost: number | null;
  from_stock: boolean;
  status: 'pending' | 'ordered' | 'received' | 'ready' | 'picked_up' | 'cancelled';
  supplier_order_id: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  book?: Book;
  order?: CustomerOrder;
}

export interface CustomerPayment {
  id: string;
  customer_id: string;
  order_id: string | null;
  amount: number;
  payment_method: 'cash' | 'card' | 'check' | 'other';
  transaction_id: string | null;
  notes: string | null;
  is_edited: boolean;
  original_amount: number | null;
  edit_reason: string | null;
  edited_at: string | null;
  is_refund: boolean;
  return_id: string | null;
  created_at: string;
  // Joined data
  customer?: Customer;
  order?: CustomerOrder;
}

export interface SupplierOrder {
  id: string;
  supplier_id: string;
  status: 'pending' | 'sent' | 'partial' | 'received' | 'cancelled';
  sent_at: string | null;
  received_at: string | null;
  total_cost: number | null;
  amount_paid: number | null;
  is_paid: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  supplier?: Supplier;
  items?: SupplierOrderItem[];
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  supplier_order_id: string | null;
  amount: number;
  payment_method: 'cash' | 'check' | 'credit' | 'wire' | 'other';
  payment_type: 'invoice' | 'deposit' | 'balance' | 'credit_memo' | 'refund' | 'other';
  invoice_number: string | null;
  reference_number: string | null;
  receipt_url: string | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
  // Joined data
  supplier?: Supplier;
  supplier_order?: SupplierOrder;
}

export interface SupplierOrderItem {
  id: string;
  supplier_order_id: string;
  book_id: string;
  customer_order_id: string | null;
  quantity: number;
  cost: number | null;
  is_received: boolean;
  received_at: string | null;
  created_at: string;
  // Joined data
  book?: Book;
  customer_order?: CustomerOrder;
}

export interface Return {
  id: string;
  book_id: string;
  supplier_id: string;
  customer_order_id: string | null;
  reason: 'damaged' | 'wrong_item' | 'customer_return' | 'other';
  reason_details: string | null;
  status: 'pending' | 'sent' | 'completed';
  quantity: number;
  refund_type: 'cash' | 'card' | 'store_credit' | null;
  refund_amount: number | null;
  refund_transaction_id: string | null;
  original_payment_method: string | null;
  refunded_at: string | null;
  return_to_supplier: boolean;
  supplier_return_reason: string | null;
  supplier_return_status: 'pending' | 'included_in_order' | 'sent' | 'completed' | null;
  created_at: string;
  updated_at: string;
  // Joined data
  book?: Book;
  supplier?: Supplier;
}

export interface SupplierReturnItem {
  id: string;
  return_id: string;
  book_id: string;
  supplier_id: string | null;
  quantity: number;
  reason: string;
  reason_details: string | null;
  status: 'pending' | 'included_in_order' | 'sent' | 'completed';
  supplier_order_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  book?: Book;
  supplier?: Supplier;
  return?: Return;
}

export interface PendingSupplierAssignment {
  id: string;
  book_id: string;
  customer_order_id: string;
  created_at: string;
  // Joined data
  book?: Book;
  customer_order?: CustomerOrder;
}

export type OrderStatus = CustomerOrder['status'];
export type SupplierOrderStatus = SupplierOrder['status'];
export type ReturnReason = Return['reason'];
export type NotificationPreference = Customer['notification_preference'];

export interface StockOrder {
  id: string;
  book_id: string;
  supplier_id: string | null;
  quantity: number;
  cost_per_unit: number | null;
  total_cost: number | null;
  status: 'pending' | 'ordered' | 'received' | 'cancelled';
  ordered_at: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  book?: Book;
  supplier?: Supplier;
}

export interface NotificationLog {
  id: string;
  customer_id: string;
  customer_order_id: string | null;
  notification_type: 'order_ready' | 'order_received' | 'custom';
  notification_method: 'phone' | 'sms' | 'email';
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  response: any;
  created_at: string;
  // Joined data
  customer?: Customer;
  customer_order?: CustomerOrder;
}

export interface Expense {
  id: string;
  category: 'rent' | 'utilities' | 'supplies' | 'payroll' | 'marketing' | 'shipping' | 'other';
  description: string;
  amount: number;
  receipt_url: string | null;
  expense_date: string;
  is_tax_deductible: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory = Expense['category'];
export type CustomerPaymentMethod = CustomerPayment['payment_method'];
export type SupplierPaymentMethod = SupplierPayment['payment_method'];

// Call logs for tracking incoming and outgoing calls
export interface CallLog {
  id: string;
  customer_id: string | null;
  phone_number: string;
  customer_name: string | null;
  direction: 'inbound' | 'outbound';
  status: 'initiated' | 'ringing' | 'in_progress' | 'completed' | 'missed' | 'busy' | 'failed' | 'no_answer';
  duration_seconds: number | null;
  call_sid: string | null;
  answered_by: string | null;
  recording_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  customer?: Customer;
}