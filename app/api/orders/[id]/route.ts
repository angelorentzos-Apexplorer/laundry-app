import { prisma } from "@/lib/prisma";
import {
  DeliveryStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";

function parseOrderIdFromUrl(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const id = Number(parts[parts.length - 1]);

  if (!id || Number.isNaN(id)) {
    return null;
  }

  return id;
}

export async function GET(req: Request) {
  try {
    const orderId = parseOrderIdFromUrl(req);

    if (!orderId) {
      return Response.json(
        { error: "Μη έγκυρο ID παραγγελίας." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        orderItems: {
          include: {
            product: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!order) {
      return Response.json(
        { error: "Η παραγγελία δεν βρέθηκε." },
        { status: 404 }
      );
    }

    return Response.json(order);
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);

    return Response.json(
      { error: "Αποτυχία φόρτωσης παραγγελίας." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const orderId = parseOrderIdFromUrl(req);

    if (!orderId) {
      return Response.json(
        { error: "Μη έγκυρο ID παραγγελίας." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        totalPrice: true,
        paidAmount: true,
      },
    });

    if (!existingOrder) {
      return Response.json(
        { error: "Η παραγγελία δεν βρέθηκε." },
        { status: 404 }
      );
    }

    const itemsDescription =
      body.itemsDescription != null
        ? String(body.itemsDescription).trim() || null
        : undefined;

    const squareMeters =
      body.squareMeters === null
        ? null
        : body.squareMeters != null && !Number.isNaN(Number(body.squareMeters))
        ? Number(body.squareMeters)
        : undefined;

    const totalPrice =
      body.totalPrice === null
        ? null
        : body.totalPrice != null && !Number.isNaN(Number(body.totalPrice))
        ? Number(body.totalPrice)
        : undefined;

    const paidAmount =
      body.paidAmount === null
        ? null
        : body.paidAmount != null && !Number.isNaN(Number(body.paidAmount))
        ? Number(body.paidAmount)
        : undefined;

    const pickupDate =
      body.pickupDate === null
        ? null
        : body.pickupDate && !Number.isNaN(Date.parse(body.pickupDate))
        ? new Date(body.pickupDate)
        : undefined;

    const deliveryDate =
      body.deliveryDate === null
        ? null
        : body.deliveryDate && !Number.isNaN(Date.parse(body.deliveryDate))
        ? new Date(body.deliveryDate)
        : undefined;

    const notes =
      body.notes != null ? String(body.notes).trim() || null : undefined;

    const status =
      body.status &&
      ["NEW", "PROCESSING", "READY", "DELIVERED", "PAID"].includes(body.status)
        ? (body.status as OrderStatus)
        : undefined;

    let nextPaymentStatus: PaymentStatus | undefined;
    let nextDeliveryStatus: DeliveryStatus | undefined;

    const effectiveTotalPrice =
      totalPrice !== undefined ? totalPrice : existingOrder.totalPrice;

    const effectivePaidAmount =
      paidAmount !== undefined ? paidAmount : existingOrder.paidAmount;

    if (
      effectiveTotalPrice != null &&
      effectivePaidAmount != null &&
      effectivePaidAmount >= effectiveTotalPrice
    ) {
      nextPaymentStatus = "PAID";
    } else if (effectivePaidAmount != null) {
      nextPaymentStatus = "UNPAID";
    }

    if (status === "DELIVERED") {
      nextDeliveryStatus = "DELIVERED";
    } else if (
      status === "NEW" ||
      status === "PROCESSING" ||
      status === "READY"
    ) {
      nextDeliveryStatus = "PENDING";
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(itemsDescription !== undefined ? { itemsDescription } : {}),
        ...(squareMeters !== undefined ? { squareMeters } : {}),
        ...(totalPrice !== undefined ? { totalPrice } : {}),
        ...(paidAmount !== undefined ? { paidAmount } : {}),
        ...(pickupDate !== undefined ? { pickupDate } : {}),
        ...(deliveryDate !== undefined ? { deliveryDate } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(nextPaymentStatus !== undefined
          ? { paymentStatus: nextPaymentStatus }
          : {}),
        ...(nextDeliveryStatus !== undefined
          ? { deliveryStatus: nextDeliveryStatus }
          : {}),
      },
      include: {
        customer: true,
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        orderItems: {
          include: {
            product: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    return Response.json(updatedOrder);
  } catch (error) {
    console.error("PATCH /api/orders/[id] error:", error);

    return Response.json(
      { error: "Αποτυχία ενημέρωσης παραγγελίας." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const orderId = parseOrderIdFromUrl(req);

    if (!orderId) {
      return Response.json(
        { error: "Μη έγκυρο ID παραγγελίας." },
        { status: 400 }
      );
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!existingOrder) {
      return Response.json(
        { error: "Η παραγγελία δεν βρέθηκε." },
        { status: 404 }
      );
    }

    await prisma.order.delete({
      where: { id: orderId },
    });

    return Response.json({
      ok: true,
      message: "Η παραγγελία διαγράφηκε επιτυχώς.",
    });
  } catch (error) {
    console.error("DELETE /api/orders/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return Response.json(
        { error: "Η παραγγελία δεν βρέθηκε." },
        { status: 404 }
      );
    }

    return Response.json(
      { error: "Αποτυχία διαγραφής παραγγελίας." },
      { status: 500 }
    );
  }
}