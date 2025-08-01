/*
  Warnings:

  - You are about to drop the column `documentId` on the `Batch` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Batch" DROP CONSTRAINT "Batch_documentId_fkey";

-- AlterTable
ALTER TABLE "public"."Batch" DROP COLUMN "documentId";

-- CreateTable
CREATE TABLE "public"."BatchDocument" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatchDocument_batchId_documentId_key" ON "public"."BatchDocument"("batchId", "documentId");

-- AddForeignKey
ALTER TABLE "public"."BatchDocument" ADD CONSTRAINT "BatchDocument_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BatchDocument" ADD CONSTRAINT "BatchDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
