import { prisma } from "@/lib/prisma";
import {
  DeliveryStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ServiceType,
} from "@prisma/client";

async function getNextSerial(
  tx: Prisma.TransactionClient,
  serviceType: ServiceType
) {
  const sequenceKey =
    serviceType === "CARPETS"
      ? "order_item_serial_carpets"
      : "order_item_serial_clothes";

  const startValue = serviceType === "CARPETS" ? 22000 : 1000;

  const existing = await tx.appSequence.findUnique({
    where: { key: sequenceKey },
  });

  if (!existing) {
    await tx.appSequence.create({
      data: {
        key: sequenceKey,
        value: startValue,
      },
    });
    return startValue;
  }

  const nextValue = existing.value + 1;

  await tx.appSequence.update({
    where: { key: sequenceKey },
    data: { value: nextValue },
  });

  return nextValue;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const customerId = Number(body.customerId);
    const serviceType = String(body.serviceType || "").trim();

    if (!customerId || Number.isNaN(customerId)) {
      return Response.json({ error: "Μη έγκυρος πελάτης." }, { status: 400 });
    }

    if (
      serviceType !== ServiceType.CLOTHES &&
      serviceType !== ServiceType.CARPETS
    ) {
      return Response.json({ error: "Μη έγκυρη υπηρεσία." }, { status: 400 });
    }

    const rows = Array.isArray(body.rows) ? body.rows : [];

    const validRows = rows.filter((row: any) => {
      const productId = Number(row?.productId);
      const quantity = Number(row?.quantity);
      const unitPrice = Number(row?.unitPrice);
      const lineTotal = Number(row?.lineTotal);

      return (
        row &&
        !Number.isNaN(productId) &&
        productId > 0 &&
        !Number.isNaN(quantity) &&
        quantity > 0 &&
        !Number.isNaN(unitPrice) &&
        unitPrice >= 0 &&
        !Number.isNaN(lineTotal) &&
        lineTotal >= 0
      );
    });

    if (rows.length > 0 && validRows.length !== rows.length) {
      return Response.json(
        { error: "Μία ή περισσότερες γραμμές προϊόντων δεν είναι έγκυρες." },
        { status: 400 }
      );
    }

    const totalItems = validRows.reduce(
      (sum: number, row: any) => sum + Number(row.quantity),
      0
    );

    const totalFromRows = validRows.reduce(
      (sum: number, row: any) => sum + Number(row.lineTotal),
      0
    );

    const paidAmount =
      body.paidAmount != null && !Number.isNaN(Number(body.paidAmount))
        ? Number(body.paidAmount)
        : null;

    const pickupDate =
      body.pickupDate && !Number.isNaN(Date.parse(body.pickupDate))
        ? new Date(body.pickupDate)
        : null;

    const deliveryDate =
      body.deliveryDate && !Number.isNaN(Date.parse(body.deliveryDate))
        ? new Date(body.deliveryDate)
        : null;

    let nextStatus: OrderStatus = "NEW";
    let nextPaymentStatus: PaymentStatus = "UNPAID";
    const nextDeliveryStatus: DeliveryStatus = "PENDING";

    if (
      totalFromRows > 0 &&
      paidAmount != null &&
      paidAmount >= totalFromRows
    ) {
      nextStatus = "PAID";
      nextPaymentStatus = "PAID";
    }

    const order = await prisma.$transaction(async (tx) => {
      const rowsWithRealSerials: Array<{
        productId: number;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        itemSerialNumber: number;
      }> = [];

      for (const row of validRows) {
        const quantity = Number(row.quantity);
        const unitPrice = Number(row.unitPrice);

        for (let i = 0; i < quantity; i++) {
          const realSerial = await getNextSerial(tx, serviceType as ServiceType);

          rowsWithRealSerials.push({
            productId: Number(row.productId),
            quantity: 1,
            unitPrice,
            lineTotal: unitPrice,
            itemSerialNumber: realSerial,
          });
        }
      }

      return tx.order.create({
        data: {
          customer: {
            connect: { id: customerId },
          },
          serviceType: serviceType as ServiceType,
          itemsDescription: body.itemsDescription || null,
          quantity: totalItems > 0 ? totalItems : null,
          squareMeters:
            body.squareMeters != null && !Number.isNaN(Number(body.squareMeters))
              ? Number(body.squareMeters)
              : null,
          totalPrice: totalFromRows > 0 ? totalFromRows : null,
          paidAmount,
          pickupDate,
          deliveryDate,
          notes: body.notes || null,
          status: nextStatus,
          deliveryStatus: nextDeliveryStatus,
          paymentStatus: nextPaymentStatus,
          orderItems: {
            create: rowsWithRealSerials,
          },
        },
        include: {
          orderItems: true,
        },
      });
    });

    return Response.json(order);
  } catch (error) {
    console.error("POST /api/orders error:", error);

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
      { error: "Αποτυχία δημιουργίας παραγγελίας." },
      { status: 500 }
    );
  }
}