/*
  Warnings:

  - Added the required column `courseId` to the `WatchRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WatchRecord" ADD COLUMN     "courseId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "WatchRecord" ADD CONSTRAINT "WatchRecord_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
