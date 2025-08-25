// src/utils/r2.ts
import {
  S3Client,
  GetObjectCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',  // R2 is regionless, use 'auto'
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
})

/**
 * Generate a presigned GET URL for an object in R2
 * @param key Path in bucket, e.g. "courses/REACT101/video1/master.m3u8"
 * @param expiresIn Seconds until URL expires
 */
export async function getSignedUrl(key: string, expiresIn: number) {
  const cmd = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  })
  return presign(r2, cmd, { expiresIn })
}
