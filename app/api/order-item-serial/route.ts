import { prisma } from "@/lib/prisma";
import { ServiceType } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const serviceType: ServiceType = body.serviceType;

    let startFrom = serviceType === "CARPETS" ? 22000 : 1000;

    const lastItem = await prisma.orderItem.findFirst({
      where: {
        itemSerialNumber: { not: null },
        order: {
          serviceType,
        },
      },
      orderBy: {
        itemSerialNumber: "desc",
      },
      select: {
        itemSerialNumber: true,
      },
    });

    const nextNumber = lastItem?.itemSerialNumber
      ? lastItem.itemSerialNumber + 1
      : startFrom;

    return Response.json({ itemSerialNumber: nextNumber });
  } catch (e) {
    return Response.json(
      { error: "Failed to generate serial" },
      { status: 500 }
    );
  }
}