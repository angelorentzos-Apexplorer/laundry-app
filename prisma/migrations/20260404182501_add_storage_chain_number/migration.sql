-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "serviceType" TEXT NOT NULL,
    "itemsDescription" TEXT,
    "quantity" INTEGER,
    "squareMeters" REAL,
    "totalPrice" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "deliveryDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "storageChainNumber" TEXT,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "customerId", "deliveryDate", "id", "itemsDescription", "notes", "paidAmount", "quantity", "serviceType", "squareMeters", "status", "totalPrice", "updatedAt") SELECT "createdAt", "customerId", "deliveryDate", "id", "itemsDescription", "notes", "paidAmount", "quantity", "serviceType", "squareMeters", "status", "totalPrice", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
