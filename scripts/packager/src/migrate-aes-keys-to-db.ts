// scripts/packager/src/migrate-aes-keys-to-db.ts
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const KEYSTORE_JSON = process.env.KEYSTORE_JSON
if (!KEYSTORE_JSON) {
  throw new Error('Missing KEYSTORE_JSON in scripts/packager/.env')
}

type Entry = { ciphertext: string; createdAt?: string }
type Keystore = Record<string, Entry>

async function main() {
  const prisma = new PrismaClient()
  try {
    const abs = path.resolve(path.join(__dirname, '..'), KEYSTORE_JSON as string)
    if (!fs.existsSync(abs)) throw new Error(`Keystore not found at ${abs}`)

    const json = JSON.parse(fs.readFileSync(abs, 'utf8')) as Keystore
    let count = 0

    for (const k of Object.keys(json)) {
      if (!k.startsWith('aes:')) continue
      const entry = json[k]
      if (!entry?.ciphertext) continue

      // key format: "aes:<course>/<video>"
      const rest = k.slice(4)
      const [courseCode, videoId] = rest.split('/')
      if (!courseCode || !videoId) continue

      await prisma.videoAesKey.upsert({
        where: { courseCode_videoId: { courseCode, videoId } },
        update: { kmsCiphertextB64: entry.ciphertext },
        create: { courseCode, videoId, kmsCiphertextB64: entry.ciphertext },
      })
      count++
      console.log(`✅ Upserted AES key for ${courseCode}/${videoId}`)
    }

    console.log(`🎉 Done. Upserted ${count} AES keys.`)
  } finally {
    await (new PrismaClient()).$disconnect().catch(() => {})
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
