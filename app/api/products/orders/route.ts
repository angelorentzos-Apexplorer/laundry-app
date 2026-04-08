import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      unitPrice: true,
      isActive: true,
    },
  });

  return Response.json(products);
}