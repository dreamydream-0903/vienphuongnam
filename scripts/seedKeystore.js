// scripts/seedKeystore.js
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Derive __dirname in an ESM context:
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  // 1) Get videoId (required) and JSON path (optional)
  const [, , videoId, jsonRelativePath] = process.argv
  if (!videoId) {
    console.error('Usage: node scripts/seedKeystore.js <videoId> [<path/to/keystore.json>]')
    process.exit(1)
  }
  const keystorePath = jsonRelativePath
    ? path.resolve(__dirname, jsonRelativePath)
    : path.resolve(__dirname, 'packager', 'keystore.json')

  // 2) Load & parse the JSON
  let raw
  try {
    raw = readFileSync(keystorePath, 'utf-8')
  } catch (err) {
    console.error(`❌ Could not read file at ${keystorePath}:`, err)
    process.exit(1)
  }
  const keystore = JSON.parse(raw)

  // 3) Upsert into VideoKeystore table
  const record = await prisma.videoKeystore.upsert({
    where:  { videoId },
    create: { videoId, keystore },
    update: { keystore },
  })

  console.log(`✅ Keystore for “${videoId}” seeded (row id=${record.id}).`)
}

main()
  .catch(err => {
    console.error('Seeding failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
