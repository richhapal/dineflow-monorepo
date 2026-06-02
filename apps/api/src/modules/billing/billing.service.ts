import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
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
    return this.prisma.order.findMany({
      where: {
        restaurant_id: restaurantId,
        status: { in: ['SERVED', 'COMPLETED'] as any[] },
        bill: null,
        deleted_at: null,
      },
      include: {
        items: { where: { is_cancelled: false } },
        table: { select: { id: true, name: true } },
      },
      orderBy: { completed_at: 'desc' },
      take: 50,
    });
  }

  async checkoutTable(tableId: string, restaurantId: string, paymentMethod: string) {
    // Find all SERVED/COMPLETED orders at this table that don't have a bill yet
    const orders = await this.prisma.order.findMany({
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
      throw new BadRequestException('No unbilled served orders at this table');
    }

    // Generate a bill per order (handles idempotency — skips if already exists)
    const bills = await Promise.all(orders.map(o => this.generateBill(o.id, restaurantId)));

    // Record payment for each bill
    await Promise.all(bills.map(bill =>
      this.recordPayment(bill.id, {
        method: paymentMethod as any,
        amount: Number(bill.total_amount),
      }, restaurantId),
    ));

    // Mark all orders as COMPLETED
    await this.prisma.order.updateMany({
      where: { id: { in: orders.map(o => o.id) } },
      data: { status: 'COMPLETED' as any },
    });

    const totalAmount = bills.reduce((sum, b) => sum + Number(b.total_amount), 0);
    return { bills, totalAmount, orderCount: orders.length };
  }

  async cancelBill(billId: string, restaurantId: string) {
    const bill = await this.prisma.bill.findFirst({ where: { id: billId, restaurant_id: restaurantId } });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status === 'PAID') throw new BadRequestException('Cannot cancel a PAID bill');
    return this.prisma.bill.update({ where: { id: billId }, data: { status: 'CANCELLED' } });
  }

  async getBill(id: string, restaurantId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id, restaurant_id: restaurantId },
      include: { order: { include: { items: { include: { addons: true } } } }, payments: true },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
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
