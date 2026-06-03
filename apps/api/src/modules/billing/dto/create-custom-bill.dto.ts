export class CustomBillItemDto {
  menu_item_id?: string;   // null/omitted for free-form items not in the menu
  item_name!: string;
  quantity!: number;
  unit_price!: number;
  notes?: string;
}

export class CreateCustomBillDto {
  customer_name?: string;
  customer_phone?: string;
  customer_gstin?: string;

  table_id?: string;
  order_type?: string;  // DINE_IN | TAKEAWAY | WAITER_PLACED (default)
  covers?: number;
  notes?: string;

  items!: CustomBillItemDto[];

  discount_amount?: number;  // flat ₹ discount

  // If provided, payment is recorded immediately and bill is set PAID
  payment_method?: string;   // CASH | UPI | CARD | COMPLIMENTARY
  upi_txn_id?: string;
  gateway_ref?: string;
  payment_notes?: string;
}
