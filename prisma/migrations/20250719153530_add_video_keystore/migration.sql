-- CreateTable
CREATE TABLE "VideoKeystore" (
    "id" SERIAL NOT NULL,
    "videoId" TEXT NOT NULL,
    "keystore" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoKeystore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoKeystore_videoId_key" ON "VideoKeystore"("videoId");
