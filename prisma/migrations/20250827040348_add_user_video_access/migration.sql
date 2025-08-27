-- CreateTable
CREATE TABLE "public"."UserVideoAccess" (
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserVideoAccess_pkey" PRIMARY KEY ("userId","videoId")
);

-- CreateIndex
CREATE INDEX "UserVideoAccess_videoId_idx" ON "public"."UserVideoAccess"("videoId");

-- AddForeignKey
ALTER TABLE "public"."UserVideoAccess" ADD CONSTRAINT "UserVideoAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserVideoAccess" ADD CONSTRAINT "UserVideoAccess_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "public"."Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
