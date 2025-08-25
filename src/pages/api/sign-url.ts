// src/pages/api/sign-url.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSignedUrl } from '@/lib/r2'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only GET allowed
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  const { key } = req.query
  if (typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid `key` query param' })
  }

  try {
    // Sign the R2 object for 5 minutes
    const url = await getSignedUrl(key, 300)
    // Redirect the client straight to R2
    return res.redirect(url)
  } catch (err: any) {
    console.error('[/api/sign-url] error signing key:', key, err)
    return res.status(500).json({ error: 'Failed to sign URL' })
  }
}
