import { prisma } from "@/lib/prisma";

export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
    },
  });

  return Response.json(customers);
}