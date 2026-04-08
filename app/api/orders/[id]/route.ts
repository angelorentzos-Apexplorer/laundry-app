import { prisma } from "@/lib/prisma";
import { ServiceType, OrderStatus, Prisma } from "@prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const orderId = Number(resolvedParams.id);

  if (!orderId || Number.isNaN(orderId)) {
    return Response.json({ error: "Μη έγκυρο order id" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      orderItems: {
        orderBy: { id: "asc" },
      },
    },
  });

  if (!order) {
    return Response.json(
      { error: "Η παραγγελία δεν βρέθηκε" },
      { status: 404 }
    );
  }

  return Response.json(order);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const orderId = Number(resolvedParams.id);

    if (!orderId || Number.isNaN(orderId)) {
      return Response.json({ error: "Μη έγκυρο order id" }, { status: 400 });
    }

    const body = await req.json();

    const customerId = Number(body.customerId);
    const serviceType = String(body.serviceType || "").trim();

    if (!customerId || Number.isNaN(customerId)) {
      return Response.json({ error: "Μη έγκυρος πελάτης" }, { status: 400 });
    }

    if (
      serviceType !== ServiceType.CLOTHES &&
      serviceType !== ServiceType.CARPETS
    ) {
      return Response.json({ error: "Μη έγκυρη υπηρεσία" }, { status: 400 });
    }

    const rows = Array.isArray(body.rows) ? body.rows : [];

    const validRows = rows.filter((row: any) => {
      const productId = Number(row?.productId);
      const quantity = Number(row?.quantity);
      const unitPrice = Number(row?.unitPrice);
      const lineTotal = Number(row?.lineTotal);
      const itemSerialNumber = Number(row?.itemSerialNumber);

      return (
        row &&
        !Number.isNaN(productId) &&
        productId > 0 &&
        !Number.isNaN(quantity) &&
        quantity > 0 &&
        !Number.isNaN(unitPrice) &&
        unitPrice >= 0 &&
        !Number.isNaN(lineTotal) &&
        lineTotal >= 0 &&
        !Number.isNaN(itemSerialNumber) &&
        itemSerialNumber >= 1000 &&
        itemSerialNumber <= 9999
      );
    });

    if (rows.length > 0 && validRows.length !== rows.length) {
      return Response.json(
        { error: "Μία ή περισσότερες γραμμές προϊόντων δεν είναι έγκυρες." },
        { status: 400 }
      );
    }

    const serials = validRows.map((row: any) => Number(row.itemSerialNumber));
    const uniqueSerials = new Set(serials);

    if (serials.length !== uniqueSerials.size) {
      return Response.json(
        { error: "Υπάρχουν διπλοί αριθμοί προϊόντων στην ίδια παραγγελία." },
        { status: 400 }
      );
    }

    const totalItems = validRows.reduce(
      (sum: number, row: any) => sum + Number(row.quantity),
      0
    );

    const totalPrice = validRows.reduce(
      (sum: number, row: any) => sum + Number(row.lineTotal),
      0
    );

    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!currentOrder) {
      return Response.json(
        { error: "Η παραγγελία δεν βρέθηκε" },
        { status: 404 }
      );
    }

    const paidAmount =
      body.paidAmount != null && !Number.isNaN(Number(body.paidAmount))
        ? Number(body.paidAmount)
        : null;

    let nextStatus: OrderStatus | undefined;

    if (totalPrice > 0 && paidAmount != null && paidAmount >= totalPrice) {
      nextStatus = "PAID";
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          customer: {
            connect: { id: customerId },
          },
          serviceType: serviceType as ServiceType,
          itemsDescription: body.itemsDescription || null,
          quantity: totalItems > 0 ? totalItems : null,
          squareMeters:
            body.squareMeters != null &&
            !Number.isNaN(Number(body.squareMeters))
              ? Number(body.squareMeters)
              : null,
          totalPrice: totalPrice > 0 ? totalPrice : null,
          paidAmount,
          deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
          notes: body.notes || null,
          storageChainNumber: body.storageChainNumber || null,
          ...(nextStatus ? { status: nextStatus } : {}),
        },
      });

      await tx.orderItem.deleteMany({
        where: { orderId },
      });

      if (validRows.length > 0) {
        await tx.orderItem.createMany({
          data: validRows.map((row: any) => ({
            orderId,
            productId: Number(row.productId),
            quantity: Number(row.quantity),
            unitPrice: Number(row.unitPrice),
            lineTotal: Number(row.lineTotal),
            itemSerialNumber: Number(row.itemSerialNumber),
          })),
        });
      }

      return tx.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          orderItems: {
            orderBy: { id: "asc" },
          },
        },
      });
    });

    return Response.json(updatedOrder);
  } catch (error) {
    console.error("PUT /api/orders/[id] error:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "Ο αριθμός προϊόντος χρησιμοποιήθηκε ήδη. Δοκιμάστε ξανά." },
        { status: 409 }
      );
    }

    return Response.json(
      { error: "Αποτυχία ενημέρωσης παραγγελίας" },
      { status: 500 }
    );
  }
}