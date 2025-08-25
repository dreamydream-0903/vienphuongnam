/*
  Warnings:

  - A unique constraint covering the columns `[r2Path]` on the table `Video` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Video_r2Path_key" ON "Video"("r2Path");
