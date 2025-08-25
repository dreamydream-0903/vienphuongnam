-- CreateTable
CREATE TABLE "public"."VideoAesKey" (
    "id" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "kmsCiphertextB64" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoAesKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoAesKey_courseCode_videoId_key" ON "public"."VideoAesKey"("courseCode", "videoId");
