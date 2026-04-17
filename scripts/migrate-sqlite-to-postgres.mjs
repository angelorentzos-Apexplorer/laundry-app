import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const SQLITE_PATH = "./prisma/dev.db";

const sqlite = new Database(SQLITE_PATH, { readonly: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function rows(table) {
  return sqlite.prepare(`SELECT * FROM "${table}"`).all();
}

function maybeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  console.log("Start migration...");

  const customers = rows("Customer");
  const products = rows("Product");
  const appSequences = rows("AppSequence");
  const orders = rows("Order");
  const payments = rows("OrderPayment");
  const orderItems = rows("OrderItem");

  console.log("Found rows:", {
    customers: customers.length,
    products: products.length,
    appSequences: appSequences.length,
    orders: orders.length,
    payments: payments.length,
    orderItems: orderItems.length,
  });

  await prisma.orderPayment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.appSequence.deleteMany();

  for (const r of customers) {
    await prisma.customer.create({
      data: {
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        fullName: r.fullName,
        phone: r.phone,
        address: r.address,
        postalCode: r.postalCode,
        companyName: r.companyName,
        vatNumber: r.vatNumber,
        notes: r.notes,
        createdAt: maybeDate(r.createdAt) ?? undefined,
        updatedAt: maybeDate(r.updatedAt) ?? undefined,
      },
    });
  }

  for (const r of products) {
    await prisma.product.create({
      data: {
        id: r.id,
        name: r.name,
        category: r.category,
        unitPrice: Number(r.unitPrice),
        isActive: Boolean(r.isActive),
        notes: r.notes,
        createdAt: maybeDate(r.createdAt) ?? undefined,
        updatedAt: maybeDate(r.updatedAt) ?? undefined,
      },
    });
  }

  for (const r of appSequences) {
    await prisma.appSequence.create({
      data: {
        key: r.key,
        value: Number(r.value),
        updatedAt: maybeDate(r.updatedAt) ?? undefined,
      },
    });
  }

  for (const r of orders) {
    await prisma.order.create({
      data: {
        id: r.id,
        customerId: r.customerId,
        serviceType: r.serviceType,
        itemsDescription: r.itemsDescription,
        quantity: r.quantity,
        squareMeters: r.squareMeters,
        totalPrice: r.totalPrice,
        paidAmount: r.paidAmount,
        pickupDate: maybeDate(r.pickupDate),
        deliveryDate: maybeDate(r.deliveryDate),
        status: r.status,
        deliveryStatus: r.deliveryStatus,
        paymentStatus: r.paymentStatus,
        notes: r.notes,
        createdAt: maybeDate(r.createdAt) ?? undefined,
        updatedAt: maybeDate(r.updatedAt) ?? undefined,
      },
    });
  }

  for (const r of payments) {
    await prisma.orderPayment.create({
      data: {
        id: r.id,
        orderId: r.orderId,
        amount: Number(r.amount),
        paymentDate: maybeDate(r.paymentDate) ?? undefined,
        notes: r.notes,
        createdAt: maybeDate(r.createdAt) ?? undefined,
      },
    });
  }

  for (const r of orderItems) {
    await prisma.orderItem.create({
      data: {
        id: r.id,
        orderId: r.orderId,
        productId: r.productId,
        quantity: r.quantity,
        unitPrice: Number(r.unitPrice),
        lineTotal: Number(r.lineTotal),
        storageChainNumber: r.storageChainNumber,
        createdAt: maybeDate(r.createdAt) ?? undefined,
        itemSerialNumber: r.itemSerialNumber,
      },
    });
  }

  console.log("Migration completed successfully.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
    sqlite.close();
  });