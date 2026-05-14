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
      : serviceType === "LINEN"
        ? "order_item_serial_linen"
        : "order_item_serial_clothes";

  const startValue =
    serviceType === "CARPETS" ? 22000 : serviceType === "LINEN" ? 50000 : 1000;

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
    const saveMode: "draft" | "final" =
      body.saveMode === "draft" ? "draft" : "final";

    const isDraft = saveMode === "draft";

    if (!customerId || Number.isNaN(customerId)) {
      return Response.json({ error: "Μη έγκυρος πελάτης." }, { status: 400 });
    }

    if (
      serviceType !== ServiceType.CLOTHES &&
      serviceType !== ServiceType.CARPETS &&
      serviceType !== ServiceType.LINEN
    ) {
      return Response.json({ error: "Μη έγκυρη υπηρεσία." }, { status: 400 });
    }

    const typedServiceType = serviceType as ServiceType;
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

    let nextStatus: OrderStatus;

    if (isDraft) {
      nextStatus = OrderStatus.DRAFT;
    } else if (
      totalFromRows > 0 &&
      paidAmount != null &&
      paidAmount >= totalFromRows
    ) {
      nextStatus = OrderStatus.PAID;
    } else {
      nextStatus = OrderStatus.NEW;
    }

    const nextPaymentStatus: PaymentStatus =
      !isDraft &&
      totalFromRows > 0 &&
      paidAmount != null &&
      paidAmount >= totalFromRows
        ? PaymentStatus.PAID
        : PaymentStatus.UNPAID;

    const nextDeliveryStatus: DeliveryStatus = DeliveryStatus.PENDING;

    const order = await prisma.$transaction(async (tx) => {
      const rowsWithRealSerials: Array<{
        productId: number;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        itemSerialNumber: number | null;
      }> = [];

      for (const row of validRows) {
        const quantity = Number(row.quantity);
        const unitPrice = Number(row.unitPrice);
        const lineTotal = Number(row.lineTotal);
        const productId = Number(row.productId);

        if (isDraft) {
          rowsWithRealSerials.push({
            productId,
            quantity,
            unitPrice,
            lineTotal,
            itemSerialNumber: null,
          });
          continue;
        }

        if (typedServiceType === ServiceType.LINEN) {
          const realSerial = await getNextSerial(tx, typedServiceType);

          rowsWithRealSerials.push({
            productId,
            quantity,
            unitPrice,
            lineTotal,
            itemSerialNumber: realSerial,
          });
        } else {
          for (let i = 0; i < quantity; i++) {
            const realSerial = await getNextSerial(tx, typedServiceType);

            rowsWithRealSerials.push({
              productId,
              quantity: 1,
              unitPrice,
              lineTotal: unitPrice,
              itemSerialNumber: realSerial,
            });
          }
        }
      }

      return tx.order.create({
        data: {
          customer: {
            connect: { id: customerId },
          },
          serviceType: typedServiceType,
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
          statusHistory: {
            create: {
              status: nextStatus,
              notes: isDraft
                ? "Προσωρινή αποθήκευση παραγγελίας."
                : "Δημιουργία παραγγελίας.",
            },
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