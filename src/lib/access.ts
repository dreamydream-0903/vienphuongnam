import { prisma } from '@/lib/prisma'

/**
 * Allow logic:
 *  - Must be enrolled in the course owning the video.
 *  - If user has ANY UserVideoAccess rows for that course, treat those as an allowlist.
 *    => Only listed videos are allowed.
 *  - If user has NONE for that course, allow ALL videos in the course (legacy behavior).
 */
export async function userHasVideoAccess(userId: string, videoId: string): Promise<boolean> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, courseId: true },
  })
  if (!video) return false

  const enrolled = await prisma.userCourse.findUnique({
    where: { userId_courseId: { userId, courseId: video.courseId } },
  })
  if (!enrolled) return false

  // // Are there any per-video rows for this user in this course?
  // const perVideoCount = await prisma.userVideoAccess.count({
  //   where: { userId, video: { courseId: video.courseId } },
  // })

  // if (perVideoCount === 0) {
  //   // no specific allowlist → default to all videos in the course
  //   return true
  // }

  const allowed = await prisma.userVideoAccess.findUnique({
    where: { userId_videoId: { userId, videoId } },
  })
  return Boolean(allowed)
}

/** Robust resolver: treat `v` as either DB id or r2Path, plus course code constraint. */
export async function resolveVideoByAnyId(courseCode: string, v: string) {
  return prisma.video.findFirst({
    where: {
      course: { code: courseCode },
      OR: [{ id: v }, { r2Path: v }],
    },
    select: { id: true, r2Path: true, courseId: true }
  })
}
