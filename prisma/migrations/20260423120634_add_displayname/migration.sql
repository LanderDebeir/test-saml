/*
  Warnings:

  - Added the required column `displayName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Made the column `imageUrl` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "displayName" TEXT NOT NULL,
ALTER COLUMN "imageUrl" SET NOT NULL;
