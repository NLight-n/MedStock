/*
  Warnings:

  - Added the required column `initialQuantity` to the `Batch` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "initialQuantity" INTEGER NOT NULL;
