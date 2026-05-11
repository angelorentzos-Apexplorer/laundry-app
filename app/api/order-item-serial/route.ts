import { prisma } from "@/lib/prisma";
import { ServiceType } from "@prisma/client";

function getSequenceKey(serviceType: ServiceType) {
  if (serviceType === "CARPETS") return "order_item_serial_carpets";
  if (serviceType === "LINEN") return "order_item_serial_linen";
  return "order_item_serial_clothes";
}

function getStartValue(serviceType: ServiceType) {
  if (serviceType === "CARPETS") return 22000;
  if (serviceType === "LINEN") return 50000;
  return 1000;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const serviceType = String(body.serviceType || "").trim();

    if (
      serviceType !== ServiceType.CLOTHES &&
      serviceType !== ServiceType.CARPETS &&
      serviceType !== ServiceType.LINEN
    ) {
      return Response.json(
        { error: "Μη έγκυρη υπηρεσία." },
        { status: 400 }
      );
    }

    const typedServiceType = serviceType as ServiceType;
    const sequenceKey = getSequenceKey(typedServiceType);
    const startValue = getStartValue(typedServiceType);

    const existing = await prisma.appSequence.findUnique({
      where: { key: sequenceKey },
      select: { value: true },
    });

    const nextNumber = existing ? existing.value + 1 : startValue;

    return Response.json({ itemSerialNumber: nextNumber });
  } catch (error) {
    console.error("POST /api/order-item-serial error:", error);

    return Response.json(
      { error: "Failed to generate serial" },
      { status: 500 }
    );
  }
}