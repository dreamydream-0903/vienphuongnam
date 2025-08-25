-- CreateTable
CREATE TABLE "public"."MuxMapping" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "videoSlug" TEXT NOT NULL,
    "playbackId" TEXT NOT NULL,
    "assetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuxMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MuxMapping_playbackId_idx" ON "public"."MuxMapping"("playbackId");

-- CreateIndex
CREATE UNIQUE INDEX "MuxMapping_courseId_videoSlug_key" ON "public"."MuxMapping"("courseId", "videoSlug");

-- AddForeignKey
ALTER TABLE "public"."MuxMapping" ADD CONSTRAINT "MuxMapping_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
