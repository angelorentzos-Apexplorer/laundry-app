import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const orderId = Number(params.id);

    if (!orderId || Number.isNaN(orderId)) {
      return Response.json(
        { error: "Μη έγκυρο ID παραγγελίας." },
        { status: 400 }
      );
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        isDeleted: true,
      },
    });

    if (!existingOrder) {
      return Response.json(
        { error: "Η παραγγελία δεν βρέθηκε." },
        { status: 404 }
      );
    }

    if (existingOrder.isDeleted) {
      return Response.json(
        { error: "Η παραγγελία έχει ήδη διαγραφεί." },
        { status: 400 }
      );
    }

    // μπλοκάρουμε completed ιστορικό
    if (
      existingOrder.status === "DELIVERED" ||
      existingOrder.status === "PAID"
    ) {
      return Response.json(
        {
          error:
            "Δεν επιτρέπεται διαγραφή πληρωμένης ή παραδομένης παραγγελίας.",
        },
        { status: 400 }
      );
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        isDeleted: true,
      },
    });

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE ORDER ERROR:", error);

    return Response.json(
      { error: "Αποτυχία διαγραφής παραγγελίας." },
      { status: 500 }
    );
  }
}