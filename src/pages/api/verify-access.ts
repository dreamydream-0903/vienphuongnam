// pages/api/verify-access.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import rawAllowed from '../../../data/allowed_emails.json'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Allow 5 requests per 60 seconds per IP
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5, '60 s'),
})

// Treat our JSON import as a generic map from string→string[]
const allowed = rawAllowed as Record<string, string[]>

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  const identifier = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress!
  const { success, limit, remaining } = await ratelimit.limit(identifier)
  res.setHeader('X-RateLimit-Limit', limit)
  res.setHeader('X-RateLimit-Remaining', remaining)

  if (!success) {
    return res.status(429).json({ message: 'Too many requests — please try again later.' })
  }

  if (req.method !== 'POST') return res.status(405).end()

  const { recaptchaToken } = req.body

  // Verify with Google
  const verifyRes = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    { method: 'POST' }
  )
  const { success: captchaSuccess } = await verifyRes.json()

  if (!captchaSuccess) {
    return res.status(400).json({ message: 'reCAPTCHA verification failed.' })
  }

  // 1) Validate session
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  const email = session.user.email

  // 2) Extract & validate code
  const { code } = req.body as { code?: string }
  if (!code) {
    return res.status(401).json({ error: 'Missing course code' })
  }

  // 3) Safely look up the allowed list
  const allowedList = allowed[code]
  if (!allowedList) {
    return res.status(401).json({ error: 'Invalid course code' })
  }

  // 4) Check if this email is in that list
  if (!allowedList.includes(email)) {
    return res.status(401).json({ error: 'Access denied' })
  }

  // 5) All good!
  res.status(200).json({ ok: true })
}
