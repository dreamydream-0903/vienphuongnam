// // scripts/packager/src/package-and-encrypt.ts

// import fs from 'fs'
// import path from 'path'
// import { spawn } from 'child_process'
// import AWS from 'aws-sdk'
// import dotenv from 'dotenv'

// // 1. Load environment variables from scripts/packager/.env
// dotenv.config({ path: path.resolve(__dirname, '../.env') })

// const SOURCE_VIDEOS_DIR = process.env.SOURCE_VIDEOS_DIR!
// const OUTPUT_BASE = process.env.OUTPUT_BASE!
// const KEYSTORE_JSON = process.env.KEYSTORE_JSON!
// const PROCESSED_LOG = process.env.PROCESSED_LOG!

// // AWS KMS client
// const kms = new AWS.KMS({ region: process.env.AWS_REGION })

// // ---- Optional Prisma (best-effort) -----------------------------------------
// type PrismaClientLike = { $disconnect: () => Promise<void>, videoAesKey: any }
// let prisma: PrismaClientLike | null = null
// if (process.env.DATABASE_URL) {
//   try {
//     // eslint-disable-next-line @typescript-eslint/no-var-requires
//     const { PrismaClient } = require('@prisma/client')
//     prisma = new PrismaClient() as PrismaClientLike
//     console.log('🟢 Prisma enabled for AES key upsert')
//   } catch (e) {
//     console.warn('⚠️ Prisma not available; skipping DB upserts for AES keys')
//   }
// } else {
//   console.log('ℹ️ DATABASE_URL not set; AES keys will be kept in JSON keystore only')
// }

// // Keystore helpers
// interface KeystoreEntry { ciphertext: string; createdAt: string }
// type Keystore = Record<string, KeystoreEntry>
// function loadKeystore(p: string): Keystore {
//   if (!fs.existsSync(p)) return {}
//   return JSON.parse(fs.readFileSync(p, 'utf8'))
// }
// function saveKeystore(p: string, ks: Keystore) {
//   fs.writeFileSync(p, JSON.stringify(ks, null, 2), 'utf8')
// }

// // Processed-log helpers
// function loadProcessed(p: string): Set<string> {
//   if (!fs.existsSync(p)) return new Set()
//   return new Set(JSON.parse(fs.readFileSync(p, 'utf8')) as string[])
// }
// function saveProcessed(p: string, s: Set<string>) {
//   fs.writeFileSync(p, JSON.stringify(Array.from(s), null, 2), 'utf8')
// }

// // Generate a new data key
// async function generateDataKey(): Promise<{ Plaintext: Buffer; CiphertextBlob: Buffer }> {
//   const resp = await kms.generateDataKey({ KeyId: process.env.KMS_KEY_ALIAS!, KeySpec: 'AES_128' }).promise()
//   return { Plaintext: resp.Plaintext as Buffer, CiphertextBlob: resp.CiphertextBlob as Buffer }
// }

// // Helper to run Shaka Packager
// function runPackager(args: string[]): Promise<void> {
//   return new Promise((resolve, reject) => {
//     const proc = spawn('packager', args, { stdio: 'inherit' })
//     proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`Packager exited ${code}`)))
//   })
// }
// function runFfmpeg(args: string[]): Promise<void> {
//   return new Promise((resolve, reject) => {
//     const proc = spawn('ffmpeg', args, { stdio: 'inherit' })
//     proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))
//   })
// }

// async function packageVideo(courseCode: string, videoId: string, inputPath: string) {
//   const baseOut = path.resolve(__dirname, '..', OUTPUT_BASE)
//   const dashOut = path.join(baseOut, courseCode, videoId, 'dash')
//   const hlsOut = path.join(baseOut, courseCode, videoId, 'hls')
//   const hlsAesOut = path.join(baseOut, courseCode, videoId, 'hls-aes128')

//   fs.mkdirSync(hlsAesOut, { recursive: true })
//   fs.mkdirSync(dashOut, { recursive: true })
//   fs.mkdirSync(hlsOut, { recursive: true })

//   // 1) Generate encryption key
//   const keystorePath = path.resolve(__dirname, '..', KEYSTORE_JSON)
//   const ks = loadKeystore(keystorePath)

//   console.log(`🔐 Generating DEK for ${courseCode}/${videoId}`)
//   const { Plaintext, CiphertextBlob } = await generateDataKey()
//   const keyHex = Plaintext.toString('hex')
//   const kid = Plaintext.subarray(0, 16).toString('hex')

//   ks[kid] = { ciphertext: CiphertextBlob.toString('base64'), createdAt: new Date().toISOString() }
//   saveKeystore(keystorePath, ks)

//   // 2) DASH packaging with proper drm_label

//   const videoDesc =
//     `in=${inputPath},stream=video,` +
//     `output=${path.join(dashOut, 'video_with_sidx.mp4')}`;

//   const audioDesc =
//     `in=${inputPath},stream=audio,` +
//     `output=${path.join(dashOut, 'audio_with_sidx.mp4')}`;

//   const dashArgs = [
//     videoDesc,
//     audioDesc,
//     '--enable_raw_key_encryption',
//     '--keys',
//     `label=HD:key_id=${kid}:key=${keyHex},` +
//     `label=UHD1:key_id=${kid}:key=${keyHex},` +
//     `label=AUDIO:key_id=${kid}:key=${keyHex}`,
//     '--protection_scheme', 'cenc',

//     '--generate_sidx_in_media_segments',

//     '--mpd_output', path.join(dashOut, 'manifest.mpd'),
//   ];


//   console.log(`📦 DASH packaging ${courseCode}/${videoId}`)
//   await runPackager(dashArgs)

//   // // 3) HLS packaging with proper segmentation and drm_label
//   // const hlsArgs = [
//   //   // Video: produce fMP4 segments with an init file + playlist
//   //   `in=${inputPath},stream=video,` +
//   //   `init_segment=${path.join(hlsOut, 'video_init.mp4')},` +
//   //   `segment_template=${path.join(hlsOut, 'video_seg-$Number$.m4s')},` +
//   //   `playlist_name=video.m3u8`,
//   //   // Audio: same pattern
//   //   `in=${inputPath},stream=audio,` +
//   //   `init_segment=${path.join(hlsOut, 'audio_init.mp4')},` +
//   //   `segment_template=${path.join(hlsOut, 'audio_seg-$Number$.m4s')},` +
//   //   `playlist_name=audio.m3u8`,

//   //   '--hls_master_playlist_output', path.join(hlsOut, 'master.m3u8'),

//   //   // DRM flags remain the same:
//   //   '--enable_raw_key_encryption',
//   //   '--keys',
//   //   `label=HD:key_id=${kid}:key=${keyHex},label=UHD1:key_id=${kid}:key=${keyHex},label=AUDIO:key_id=${kid}:key=${keyHex}`,
//   //   '--protection_scheme', 'cenc',

//   //   '--hls_playlist_type', 'VOD',
//   //   // Keep your 2 s chunk size (rounded to keyframe intervals)
//   //   '--segment_duration', '2',
//   // ]

//   // console.log(`📦 HLS packaging ${courseCode}/${videoId}`)
//   // await runPackager(hlsArgs)

//   // ---- 3) NEW: HLS AES-128 (TS) via ffmpeg ---------------------------------
//   // Generate a separate AES-128 key for this video (do not reuse ClearKey).
//   console.log(`🔐 [AES-128] Generating key for ${courseCode}/${videoId}`)
//   const { Plaintext: AesPlain, CiphertextBlob: AesCipher } = await generateDataKey()
//   const aesKeyBytes = AesPlain as Buffer // 16 bytes

//   // Persist AES key to keystore JSON under "aes:<course>/<video>"
//   const aesStoreKey = `aes:${courseCode}/${videoId}`
//   ks[aesStoreKey] = { ciphertext: AesCipher.toString('base64'), createdAt: new Date().toISOString() }
//   saveKeystore(keystorePath, ks)

//   // Optional: also persist to DB if Prisma is available
//   if (prisma) {
//     try {
//       await (prisma as any).videoAesKey.upsert({
//         where: { courseCode_videoId: { courseCode, videoId } },
//         update: { kmsCiphertextB64: AesCipher.toString('base64') },
//         create: {
//           courseCode,
//           videoId,
//           kmsCiphertextB64: AesCipher.toString('base64'),
//         }
//       })
//       console.log('🗄️  [AES-128] Key upserted to DB')
//     } catch (e) {
//       console.warn('⚠️  [AES-128] Prisma upsert failed; using JSON keystore only')
//     }
//   }

//   // Prepare a temporary key file & ffmpeg key-info file
//   const tmpDir = fs.mkdtempSync(path.join(hlsAesOut, 'tmp-'))
//   const rawKeyPath = path.join(tmpDir, 'aes.key')
//   fs.writeFileSync(rawKeyPath, aesKeyBytes) // raw 16 bytes; will be deleted shortly

//   // The URI we embed in playlists (will be enforced/rewritten by your API anyway)
//   const keyUriRelative = `/api/hls-key?course=${encodeURIComponent(courseCode)}&video=${encodeURIComponent(videoId)}`
//   const keyInfoPath = path.join(tmpDir, 'key.info')
//   // 2 lines: <key-URI>\n<path-to-raw-key>\n
//   fs.writeFileSync(keyInfoPath, `${keyUriRelative}\n${rawKeyPath}\n`, 'utf8')

//   // Create output folder for variant 0
//   const variantDir = path.join(hlsAesOut, 'v0')
//   fs.mkdirSync(variantDir, { recursive: true })

//   // ffmpeg args: one 720p variant (tune as needed)
//   const outPattern = path.join(variantDir, 'seg_%03d.ts')
//   const ffArgs = [
//     '-y',
//     '-i', inputPath,

//     // Video encode (tune these to your targets)
//     '-c:v', 'libx264',
//     '-profile:v', 'main',
//     '-level:v', '4.0',
//     '-pix_fmt', 'yuv420p',
//     '-preset', 'medium',
//     '-b:v', '2800k',
//     '-maxrate', '3000k',
//     '-bufsize', '6000k',

//     // Audio encode
//     '-c:a', 'aac',
//     '-b:a', '128k',
//     '-ar', '48000',

//     // HLS (TS) + AES-128
//     '-hls_time', '6',
//     '-hls_playlist_type', 'vod',
//     '-hls_flags', 'independent_segments',
//     '-hls_segment_type', 'mpegts',
//     '-hls_key_info_file', keyInfoPath,
//     '-hls_segment_filename', outPattern,
//     path.join(variantDir, 'index.m3u8'),
//   ]

//   console.log(`📦 [AES-128] HLS (TS) packaging ${courseCode}/${videoId}`)
//   try {
//     await runFfmpeg(ffArgs)
//   } finally {
//     // cleanup secrets on disk
//     fs.rmSync(tmpDir, { recursive: true, force: true })
//   }

//   // Write a minimal master playlist (single variant)
//   const master = [
//     '#EXTM3U',
//     '#EXT-X-VERSION:3',
//     '#EXT-X-STREAM-INF:BANDWIDTH=3200000,AVERAGE-BANDWIDTH=2800000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"',
//     'v0/index.m3u8',
//   ].join('\n')
//   fs.writeFileSync(path.join(hlsAesOut, 'master.m3u8'), master, 'utf8')

//   console.log(`✅ Done ${courseCode}/${videoId}`)
// }

// async function main() {
//   const sourceDir = path.resolve(__dirname, '..', SOURCE_VIDEOS_DIR)
//   const logPath = path.resolve(__dirname, '..', PROCESSED_LOG)
//   const done = loadProcessed(logPath)

//   for (const courseCode of fs.readdirSync(sourceDir)) {
//     const courseDir = path.join(sourceDir, courseCode)
//     if (!fs.statSync(courseDir).isDirectory()) continue
//     for (const file of fs.readdirSync(courseDir)) {
//       if (!file.endsWith('.mp4')) continue
//       const videoId = file.replace(/\.mp4$/, '')
//       const key = `${courseCode}/${videoId}`
//       if (done.has(key)) {
//         console.log(`⏭ Skipping ${key}`)
//         continue
//       }
//       await packageVideo(courseCode, videoId, path.join(courseDir, file))
//       done.add(key)
//       saveProcessed(logPath, done)
//     }
//   }

//   console.log('🎉 All new videos processed')
// }

// // ---- Utils ------------------------------------------------------------------
// function mustEnv(name: string): string {
//   const v = process.env[name]
//   if (!v) throw new Error(`Missing env: ${name}`)
//   return v
// }

// main()
//   .catch(err => { console.error(err); process.exit(1) })
//   .finally(async () => {
//     if (prisma) await prisma.$disconnect?.()
//   })

// scripts/packager/src/package-and-encrypt.ts

import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import AWS from 'aws-sdk'
import dotenv from 'dotenv'

// 1. Load environment variables from scripts/packager/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const SOURCE_VIDEOS_DIR = process.env.SOURCE_VIDEOS_DIR!
const OUTPUT_BASE = process.env.OUTPUT_BASE!
const KEYSTORE_JSON = process.env.KEYSTORE_JSON!
const PROCESSED_LOG = process.env.PROCESSED_LOG!

// AWS KMS client
const kms = new AWS.KMS({ region: process.env.AWS_REGION })

// Keystore helpers
interface KeystoreEntry { ciphertext: string; createdAt: string }
type Keystore = Record<string, KeystoreEntry>
function loadKeystore(p: string): Keystore {
  if (!fs.existsSync(p)) return {}
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}
function saveKeystore(p: string, ks: Keystore) {
  fs.writeFileSync(p, JSON.stringify(ks, null, 2), 'utf8')
}

// Processed-log helpers
function loadProcessed(p: string): Set<string> {
  if (!fs.existsSync(p)) return new Set()
  return new Set(JSON.parse(fs.readFileSync(p, 'utf8')) as string[])
}
function saveProcessed(p: string, s: Set<string>) {
  fs.writeFileSync(p, JSON.stringify(Array.from(s), null, 2), 'utf8')
}

// Generate a new data key
async function generateDataKey(): Promise<{ Plaintext: Buffer; CiphertextBlob: Buffer }> {
  const resp = await kms.generateDataKey({ KeyId: process.env.KMS_KEY_ALIAS!, KeySpec: 'AES_128' }).promise()
  return { Plaintext: resp.Plaintext as Buffer, CiphertextBlob: resp.CiphertextBlob as Buffer }
}

// Helper to run Shaka Packager
function runPackager(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('packager', args, { stdio: 'inherit' })
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`Packager exited ${code}`)))
  })
}

async function packageVideo(courseCode: string, videoId: string, inputPath: string) {
  const baseOut = path.resolve(__dirname, '..', OUTPUT_BASE)
  const dashOut = path.join(baseOut, courseCode, videoId, 'dash')
  const hlsOut = path.join(baseOut, courseCode, videoId, 'hls')
  fs.mkdirSync(dashOut, { recursive: true })
  fs.mkdirSync(hlsOut, { recursive: true })

  // 1) Generate encryption key
  const keystorePath = path.resolve(__dirname, '..', KEYSTORE_JSON)
  const ks = loadKeystore(keystorePath)
  console.log(`🔐 Generating DEK for ${courseCode}/${videoId}`)
  const { Plaintext, CiphertextBlob } = await generateDataKey()
  const keyHex = Plaintext.toString('hex')
  const kid = Plaintext.subarray(0, 16).toString('hex')
  console.log('[TEST] KID:', kid)
  console.log('[TEST] KEY:', keyHex)

  ks[kid] = { ciphertext: CiphertextBlob.toString('base64'), createdAt: new Date().toISOString() }
  saveKeystore(keystorePath, ks)

  // 2) DASH packaging with proper drm_label
  // const dashArgs = [
  //   `in=${inputPath},stream=video,output=${path.join(dashOut, 'video_init.mp4')},segment_template=${path.join(dashOut, 'video_seg-$Number$.m4s')}`,
  //   `in=${inputPath},stream=audio,output=${path.join(dashOut, 'audio_init.mp4')},segment_template=${path.join(dashOut, 'audio_seg-$Number$.m4s')}`,
  //   '--enable_raw_key_encryption',
  //   '--keys',
  //   `label=HD:key_id=${kid}:key=${keyHex},label=AUDIO:key_id=${kid}:key=${keyHex}`,
  //   '--protection_scheme', 'cenc',
  //   '--segment_duration', '4',
  //   '--mpd_output', path.join(dashOut, 'manifest.mpd'),
  // ]

  const videoDesc =
    `in=${inputPath},stream=video,` +
    `output=${path.join(dashOut, 'video_with_sidx.mp4')}`;

  const audioDesc =
    `in=${inputPath},stream=audio,` +
    `output=${path.join(dashOut, 'audio_with_sidx.mp4')}`;

  const dashArgs = [
    videoDesc,
    audioDesc,

    // encryption:
    '--enable_raw_key_encryption',
    '--keys',
    `label=HD:key_id=${kid}:key=${keyHex},` +
    `label=UHD1:key_id=${kid}:key=${keyHex},` +
    `label=AUDIO:key_id=${kid}:key=${keyHex}`,
    '--protection_scheme', 'cenc',

    '--generate_sidx_in_media_segments',

    '--mpd_output', path.join(dashOut, 'manifest.mpd'),
  ];


  console.log(`📦 DASH packaging ${courseCode}/${videoId}`)
  await runPackager(dashArgs)

  // 3) HLS packaging with proper segmentation and drm_label
  // const hlsArgs = [
  //   // Video stream with HD label - HLS uses playlist_name instead of output for playlists
  //   `in=${inputPath},stream=video,playlist_name=video.m3u8,segment_template=${path.join(hlsOut, 'video_seg-$Number$.m4s')}`,
  //   // Audio stream with AUDIO label - HLS uses playlist_name instead of output for playlists
  //   `in=${inputPath},stream=audio,playlist_name=audio.m3u8,segment_template=${path.join(hlsOut, 'audio_seg-$Number$.m4s')}`,
  //   '--hls_master_playlist_output', path.join(hlsOut, 'master.m3u8'),
  //   '--enable_raw_key_encryption',
  //   '--keys',
  //   `label=UHD1:key_id=${kid}:key=${keyHex},label=AUDIO:key_id=${kid}:key=${keyHex}`,
  //   '--protection_scheme', 'cenc',
  //   '--hls_playlist_type', 'VOD',
  //   '--segment_duration', '2',
  // ]

  // const hlsArgs = [
  //   // Video: produce fMP4 segments with an init file + playlist
  //   `in=${inputPath},stream=video,` +
  //   `init_segment=${path.join(hlsOut, 'video_init.mp4')},` +
  //   `segment_template=${path.join(hlsOut, 'video_seg-$Number$.m4s')},` +
  //   `playlist_name=video.m3u8`,
  //   // Audio: same pattern
  //   `in=${inputPath},stream=audio,` +
  //   `init_segment=${path.join(hlsOut, 'audio_init.mp4')},` +
  //   `segment_template=${path.join(hlsOut, 'audio_seg-$Number$.m4s')},` +
  //   `playlist_name=audio.m3u8`,

  //   '--hls_master_playlist_output', path.join(hlsOut, 'master.m3u8'),

  //   // DRM flags remain the same:
  //   '--enable_raw_key_encryption',
  //   '--keys',
  //   `label=HD:key_id=${kid}:key=${keyHex},label=UHD1:key_id=${kid}:key=${keyHex},label=AUDIO:key_id=${kid}:key=${keyHex}`,
  //   '--protection_scheme', 'cenc',

  //   '--hls_playlist_type', 'VOD',
  //   // Keep your 2 s chunk size (rounded to keyframe intervals)
  //   '--segment_duration', '2',
  // ]

  // console.log(`📦 HLS packaging ${courseCode}/${videoId}`)
  // await runPackager(hlsArgs)

  console.log(`✅ Done ${courseCode}/${videoId}`)
}

async function main() {
  const sourceDir = path.resolve(__dirname, '..', SOURCE_VIDEOS_DIR)
  const logPath = path.resolve(__dirname, '..', PROCESSED_LOG)
  const done = loadProcessed(logPath)

  for (const courseCode of fs.readdirSync(sourceDir)) {
    const courseDir = path.join(sourceDir, courseCode)
    if (!fs.statSync(courseDir).isDirectory()) continue
    for (const file of fs.readdirSync(courseDir)) {
      if (!file.endsWith('.mp4')) continue
      const videoId = file.replace(/\.mp4$/, '')
      const key = `${courseCode}/${videoId}`
      if (done.has(key)) {
        console.log(`⏭ Skipping ${key}`)
        continue
      }
      await packageVideo(courseCode, videoId, path.join(courseDir, file))
      done.add(key)
      saveProcessed(logPath, done)
    }
  }

  console.log('🎉 All new videos processed')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
