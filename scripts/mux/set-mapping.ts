import 'dotenv/config'

import { prisma } from '../../src/lib/prisma'

// Usage: ts-node scripts/mux/set-mapping.ts TKNC_CBQT Ngay19_BuoiChieu uNbxnGLKJ00yfb...
async function main() {
  const [courseCode, videoSlug, playbackId, assetId] = process.argv.slice(2)
  if (!courseCode || !videoSlug || !playbackId) {
    throw new Error('Usage: <courseCode> <videoSlug> <playbackId> [assetId]')
  }
  const course = await prisma.course.findUnique({ where: { code: courseCode } })
  if (!course) throw new Error('Course not found')

  await prisma.muxMapping.upsert({
    where: { courseId_videoSlug: { courseId: course.id, videoSlug } },
    update: { playbackId, assetId: assetId || undefined },
    create: { courseId: course.id, videoSlug, playbackId, assetId: assetId || undefined },
  })
  console.log('✅ Set Mux mapping:', { courseCode, videoSlug, playbackId })
}
main().finally(() => prisma.$disconnect())
