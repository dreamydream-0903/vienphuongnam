// src/lib/rateLimiter.ts
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const redis = Redis.fromEnv()
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5, '60 s'),
})
