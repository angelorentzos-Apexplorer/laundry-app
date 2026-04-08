import { prisma } from "@/lib/prisma";
import { ProductType, ServiceType } from "@prisma/client";

function getSequenceKey(serviceType: ServiceType) {
  return serviceType === "CARPETS"
    ? "order_item_serial_carpets"
    : "order_item_serial_clothes";
}

function getStartValue(serviceType: ServiceType) {
  return serviceType === "CARPETS" ? 22000 : 1000;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const serviceType = String(body?.serviceType || "CLOTHES") as ServiceType;

    if (serviceType !== "CLOTHES" && serviceType !== "CARPETS") {
      return Response.json(
        { error: "Μη έγκυρη υπηρεσία." },
        { status: 400 }
      );
    }

    const sequenceKey = getSequenceKey(serviceType);
    const startValue = getStartValue(serviceType);

    const result = await prisma.$transaction(async (tx) => {
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
        data: {
          value: nextValue,
        },
      });

      return nextValue;
    });

    return Response.json({ itemSerialNumber: result });
  } catch (error) {
    console.error("POST /api/order-item-serial error:", error);
    return Response.json(
      { error: "Αποτυχία δημιουργίας αριθμού προϊόντος." },
      { status: 500 }
    );
  }
}