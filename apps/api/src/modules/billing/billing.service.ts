import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { formatInvoiceNumber, getFinancialYear } from '@dineflow/utils';
import { HSN_CODE } from '@dineflow/config';
import * as Papa from 'papaparse';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async generateBill(orderId: string, restaurantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurant_id: restaurantId },
      include: { items: { include: { addons: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!['SERVED', 'COMPLETED'].includes(order.status)) {
      throw new BadRequestException('Order must be SERVED or COMPLETED to generate a bill');
    }

    // Check if bill already exists
    const existingBill = await this.prisma.bill.findUnique({ where: { order_id: orderId } });
    if (existingBill) return existingBill;

    // Atomic invoice sequence increment
    const restaurant = await this.prisma.$transaction(async (tx) => {
      return tx.restaurant.update({
        where: { id: restaurantId },
        data: { invoice_seq_counter: { increment: 1 } },
      });
    });

    const invoiceNumber = formatInvoiceNumber(
      restaurantId.slice(-4).toUpperCase(),
      restaurant.invoice_seq_counter,
    );
    const financialYear = getFinancialYear();
    const gstRate = Number(restaurant.gst_rate);
    const halfRate = gstRate / 2;

    const bill = await this.prisma.bill.create({
      data: {
        order_id: orderId,
        restaurant_id: restaurantId,
        invoice_number: invoiceNumber,
        financial_year: financialYear,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        subtotal: order.subtotal,
        cgst_rate: halfRate,
        cgst_amount: order.cgst_amount,
        sgst_rate: halfRate,
        sgst_amount: order.sgst_amount,
        service_charge: order.service_charge,
        discount_amount: order.discount_amount,
        total_amount: order.total_amount,
        hsn_code: HSN_CODE,
        status: 'GENERATED',
      },
    });

    // Enqueue WhatsApp if enabled
    if (restaurant.whatsapp_bill && order.customer_phone) {
      await this.notificationsQueue.add('send-whatsapp-bill', {
        billId: bill.id,
        restaurantId,
      });
    }

    return bill;
  }

  async getBills(restaurantId: string, filters: { page?: number; limit?: number; month?: number; year?: number } = {}) {
    const { page = 1, limit = 50, month, year } = filters;
    const skip = (page - 1) * limit;

    const where: any = { restaurant_id: restaurantId };
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      where.invoice_date = { gte: start, lt: end };
    }

    const [bills, total] = await Promise.all([
      this.prisma.bill.findMany({
        where,
        orderBy: { invoice_date: 'desc' },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              order_number: true,
              covers: true,
              order_type: true,
              table: { select: { id: true, name: true } },
            },
          },
          payments: {
            select: { id: true, method: true, amount: true, status: true, paid_at: true, upi_txn_id: true, notes: true },
          },
        },
      }),
      this.prisma.bill.count({ where }),
    ]);

    return { bills, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getUnbilledOrders(restaurantId: string) {
    // SERVED orders that either have no bill at all, or only a CANCELLED bill
    // (COMPLETED = already processed by combined/checkout billing — exclude them)
    return this.prisma.order.findMany({
      where: {
        restaurant_id: restaurantId,
        status: 'SERVED' as any,
        deleted_at: null,
        OR: [
          { bill: null } as any,
          { bill: { is: { status: 'CANCELLED' } } } as any,
        ],
      },
      include: {
        items: { where: { is_cancelled: false } },
        table: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  /** Generate ONE consolidated bill for a manually selected set of orders */
  async generateCombinedBill(orderIds: string[], restaurantId: string) {
    if (!orderIds || orderIds.length === 0) throw new BadRequestException('No orders provided');

    // 1. Load all orders
    const orders = await this.prisma.order.findMany({
      where: {
        id: { in: orderIds },
        restaurant_id: restaurantId,
        status: { in: ['SERVED', 'COMPLETED'] as any[] },
        deleted_at: null,
      },
      include: { items: { include: { addons: true } } },
    });

    if (orders.length !== orderIds.length) {
      throw new BadRequestException('Some orders were not found or are not yet served');
    }

    // 2. Ensure none already billed
    const alreadyBilled = await this.prisma.bill.count({
      where: { order_id: { in: orderIds } },
    });
    if (alreadyBilled > 0) throw new BadRequestException('One or more orders already have a bill');

    // 3. All orders must share the same table (or all have no table)
    const tableIds = [...new Set(orders.map((o: any) => o.table_id).filter(Boolean))];
    if (tableIds.length > 1) throw new BadRequestException('Cannot combine orders from different tables');
    const tableId: string | null = tableIds[0] ?? null;

    // 4. Aggregate totals + combined customer label
    const subtotal      = orders.reduce((s: number, o: any) => s + Number(o.subtotal), 0);
    const cgstAmount    = orders.reduce((s: number, o: any) => s + Number(o.cgst_amount), 0);
    const sgstAmount    = orders.reduce((s: number, o: any) => s + Number(o.sgst_amount), 0);
    const serviceCharge = orders.reduce((s: number, o: any) => s + Number(o.service_charge), 0);
    const discountAmount= orders.reduce((s: number, o: any) => s + Number(o.discount_amount || 0), 0);
    const totalAmount   = orders.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
    const names = orders.map((o: any) => o.customer_name).filter(Boolean) as string[];
    const combinedCustomerName = names.length === 0
      ? null
      : names.length === 1
        ? names[0]
        : `${names[0]} + ${names.length - 1} more`;

    const bill = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.update({
        where: { id: restaurantId },
        data: { invoice_seq_counter: { increment: 1 } },
      });
      const invoiceNumber  = formatInvoiceNumber(restaurantId.slice(-4).toUpperCase(), restaurant.invoice_seq_counter);
      const financialYear  = getFinancialYear();
      const halfRate       = Number(restaurant.gst_rate) / 2;

      // 5. Find or create a TableSession so getBill can return per-person data
      let sessionId: string | null = null;
      if (tableId) {
        // Try existing active session without a bill already
        let session = await (tx as any).tableSession.findFirst({
          where: {
            table_id: tableId,
            restaurant_id: restaurantId,
            status: 'ACTIVE',
            bill: null,          // only if it has no bill yet
          },
        });
        if (!session) {
          // Create a fresh session purely to carry per-person data
          session = await (tx as any).tableSession.create({
            data: {
              restaurant_id: restaurantId,
              table_id: tableId,
              session_qr_slug: randomBytes(4).toString('hex'),
              status: 'ACTIVE',
            },
          });
        }
        sessionId = session.id;
        // Link all orders to this session so getBill returns them
        await tx.order.updateMany({
          where: { id: { in: orderIds } },
          data: { table_session_id: sessionId } as any,
        });
      }

      // 6. Create ONE consolidated bill
      const newBill = await tx.bill.create({
        data: {
          order_id: null,
          table_session_id: sessionId,
          restaurant_id: restaurantId,
          invoice_number: invoiceNumber,
          financial_year: financialYear,
          customer_name: combinedCustomerName,
          subtotal,
          cgst_rate: halfRate,
          cgst_amount: cgstAmount,
          sgst_rate: halfRate,
          sgst_amount: sgstAmount,
          service_charge: serviceCharge,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          hsn_code: HSN_CODE,
          status: 'GENERATED',
        } as any,
      });

      // 7. Mark all orders COMPLETED and close the session
      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: { status: 'COMPLETED' as any },
      });
      if (sessionId) {
        await (tx as any).tableSession.update({
          where: { id: sessionId },
          data: { status: 'CLOSED', closed_at: new Date() },
        });
      }

      return newBill;
    });

    return { bill, totalAmount, orderCount: orders.length };
  }

  async checkoutTable(tableId: string, restaurantId: string, paymentMethod: string) {
    // Find the ACTIVE table session for this table
    const session = await (this.prisma as any).tableSession.findFirst({
      where: { table_id: tableId, restaurant_id: restaurantId, status: 'ACTIVE' },
      include: {
        orders: {
          where: {
            status: { in: ['SERVED', 'COMPLETED'] as any[] },
            deleted_at: null,
          },
          include: { items: { include: { addons: true } } },
        },
      },
    });

    // Fall back: no session — find any unbilled served orders at this table directly
    const orders = session
      ? session.orders
      : await this.prisma.order.findMany({
          where: {
            table_id: tableId,
            restaurant_id: restaurantId,
            status: { in: ['SERVED', 'COMPLETED'] as any[] },
            bill: null,
            deleted_at: null,
          },
          include: { items: { include: { addons: true } } },
        });

    if (orders.length === 0) {
      throw new BadRequestException('No served orders at this table');
    }

    // Build consolidated totals + combined customer label
    const subtotal       = orders.reduce((s: number, o: any) => s + Number(o.subtotal), 0);
    const cgstAmount     = orders.reduce((s: number, o: any) => s + Number(o.cgst_amount), 0);
    const sgstAmount     = orders.reduce((s: number, o: any) => s + Number(o.sgst_amount), 0);
    const serviceCharge  = orders.reduce((s: number, o: any) => s + Number(o.service_charge), 0);
    const discountAmount = orders.reduce((s: number, o: any) => s + Number(o.discount_amount || 0), 0);
    const totalAmount    = orders.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
    const tableNames     = orders.map((o: any) => o.customer_name).filter(Boolean) as string[];
    const tableCustomerName = tableNames.length === 0
      ? null
      : tableNames.length === 1
        ? tableNames[0]
        : `${tableNames[0]} + ${tableNames.length - 1} more`;

    // Atomic: create ONE bill for the session, record payment, mark orders COMPLETED, close session
    const bill = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.update({
        where: { id: restaurantId },
        data: { invoice_seq_counter: { increment: 1 } },
      });

      const invoiceNumber = formatInvoiceNumber(
        restaurantId.slice(-4).toUpperCase(),
        restaurant.invoice_seq_counter,
      );
      const financialYear = getFinancialYear();
      const gstRate = Number(restaurant.gst_rate);
      const halfRate = gstRate / 2;

      // ONE consolidated bill
      const bill = await tx.bill.create({
        data: {
          order_id: null,                          // session bill — no single order
          table_session_id: session?.id ?? null,
          restaurant_id: restaurantId,
          invoice_number: invoiceNumber,
          financial_year: financialYear,
          customer_name: tableCustomerName,
          subtotal,
          cgst_rate: halfRate,
          cgst_amount: cgstAmount,
          sgst_rate: halfRate,
          sgst_amount: sgstAmount,
          service_charge: serviceCharge,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          hsn_code: HSN_CODE,
          status: 'GENERATED',
        } as any,
      });

      // Record payment against the consolidated bill
      await tx.payment.create({
        data: {
          order_id: null,
          bill_id: bill.id,
          restaurant_id: restaurantId,
          method: paymentMethod as any,
          status: 'PAID',
          amount: totalAmount,
          paid_at: new Date(),
        } as any,
      });

      await tx.bill.update({ where: { id: bill.id }, data: { status: 'PAID' } });

      // Mark all orders COMPLETED
      await tx.order.updateMany({
        where: { id: { in: orders.map((o: any) => o.id) } },
        data: { status: 'COMPLETED' as any },
      });

      // Close the session
      if (session) {
        await (tx as any).tableSession.update({
          where: { id: session.id },
          data: { status: 'CLOSED', closed_at: new Date() },
        });
      }

      return bill;
    });

    return { bill, totalAmount, orderCount: orders.length };
  }

  async cancelBill(billId: string, restaurantId: string) {
    const bill = await this.prisma.bill.findFirst({ where: { id: billId, restaurant_id: restaurantId } }) as any;
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status === 'PAID') throw new BadRequestException('Cannot cancel a PAID bill');

    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.bill.update({ where: { id: billId }, data: { status: 'CANCELLED' } });

      if (bill.order_id) {
        // Single-order bill: put the order back to SERVED so it reappears in Unbilled
        await tx.order.update({
          where: { id: bill.order_id },
          data: { status: 'SERVED' as any },
        });
      } else if (bill.table_session_id) {
        // Session / combined bill: restore every order in the session to SERVED
        await tx.order.updateMany({
          where: { table_session_id: bill.table_session_id } as any,
          data: { status: 'SERVED' as any },
        });
        // Reopen the session so future combined-bill generation works
        await (tx as any).tableSession.update({
          where: { id: bill.table_session_id },
          data: { status: 'ACTIVE', closed_at: null },
        });
      }

      return cancelled;
    });
  }

  async getBill(id: string, restaurantId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id, restaurant_id: restaurantId },
      include: {
        order: {
          include: {
            items: { include: { addons: true } },
            table: { select: { id: true, name: true } },
          },
        },
        payments: true,
      },
    });
    if (!bill) throw new NotFoundException('Bill not found');

    // For session bills: attach session data with per-person orders
    let sessionData: any = null;
    if ((bill as any).table_session_id) {
      sessionData = await (this.prisma as any).tableSession.findUnique({
        where: { id: (bill as any).table_session_id },
        include: {
          table: { select: { id: true, name: true } },
          orders: {
            where: { deleted_at: null, status: { notIn: ['CANCELLED'] } },
            orderBy: { created_at: 'asc' as const },
            include: {
              items: { where: { is_cancelled: false }, include: { addons: true } },
            },
          },
        },
      });
    }

    return { ...bill, sessionData };
  }

  async getBillPublic(id: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: { order: { include: { items: { include: { addons: true } } } }, restaurant: { select: { name: true, logo_public_id: true, address: true, gstin: true } } },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  async sendBillWhatsApp(billId: string, restaurantId: string) {
    const bill = await this.prisma.bill.findFirst({ where: { id: billId, restaurant_id: restaurantId } });
    if (!bill) throw new NotFoundException('Bill not found');
    await this.notificationsQueue.add('send-whatsapp-bill', { billId, restaurantId });
    return { queued: true };
  }

  async recordPayment(billId: string, dto: RecordPaymentDto, restaurantId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, restaurant_id: restaurantId },
    });
    if (!bill) throw new NotFoundException('Bill not found');

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          order_id: bill.order_id,
          bill_id: billId,
          restaurant_id: restaurantId,
          method: dto.method as any,
          status: 'PAID',
          amount: dto.amount,
          gateway_ref: dto.gateway_ref,
          upi_txn_id: dto.upi_txn_id,
          notes: dto.notes,
          paid_at: new Date(),
        },
      });
      await tx.bill.update({ where: { id: billId }, data: { status: 'PAID' } });
      return payment;
    });
  }

  async getGSTSummary(restaurantId: string, month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const bills = await this.prisma.bill.findMany({
      where: { restaurant_id: restaurantId, invoice_date: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
    });

    const summary = bills.reduce(
      (acc, b) => ({
        total_invoices: acc.total_invoices + 1,
        gross_revenue: acc.gross_revenue + Number(b.total_amount),
        taxable_value: acc.taxable_value + Number(b.subtotal),
        cgst: acc.cgst + Number(b.cgst_amount),
        sgst: acc.sgst + Number(b.sgst_amount),
        total_gst: acc.total_gst + Number(b.cgst_amount) + Number(b.sgst_amount),
      }),
      { total_invoices: 0, gross_revenue: 0, taxable_value: 0, cgst: 0, sgst: 0, total_gst: 0 },
    );

    return { month, year, ...summary };
  }

  async exportGSTR1(restaurantId: string, month: number, year: number): Promise<string> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const bills = await this.prisma.bill.findMany({
      where: { restaurant_id: restaurantId, invoice_date: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
      orderBy: { invoice_date: 'asc' },
    });

    const rows = bills.map((b) => ({
      'Invoice Number': b.invoice_number,
      'Invoice Date': new Date(b.invoice_date).toLocaleDateString('en-IN'),
      'Invoice Value': Number(b.total_amount).toFixed(2),
      'Taxable Value': Number(b.subtotal).toFixed(2),
      'CGST': Number(b.cgst_amount).toFixed(2),
      'SGST': Number(b.sgst_amount).toFixed(2),
      'IGST': Number(b.igst_amount).toFixed(2),
      'HSN/SAC': b.hsn_code,
      'Rate': `${(Number(b.cgst_rate) * 2 * 100).toFixed(0)}%`,
    }));

    return Papa.unparse(rows);
  }
}
