import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  const product = await prisma.product.create({
    data: {
      name: body.name,
      unitPrice: body.unitPrice,
      category: body.category,
      isActive: body.isActive,
    },
  });

  return Response.json(product);
}