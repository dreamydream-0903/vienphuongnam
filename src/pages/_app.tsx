// pages/_app.tsx
import React from 'react'
import { useRouter } from 'next/router'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { darkTheme } from '../theme'
import '@/styles/globals.css'

import type { AppProps } from 'next/app'
import AdminLayout from '@/components/AdminLayout'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from "@vercel/speed-insights/next"


export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isAdminRoute = router.pathname.startsWith('/admin')

  // pull out session (for SessionProvider) and pass the rest to pages
  const { session, ...rest } = pageProps as any

  // choose layout based on route
  const Layout = isAdminRoute ? AdminLayout : React.Fragment

  return (
    <SessionProvider
      session={session}
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      <ThemeProvider theme={darkTheme}>
        <div className="min-h-screen flex flex-col">
          <CssBaseline />
          <Layout>
            <Component {...rest} />

            <Analytics />
            <SpeedInsights />
          </Layout>
        </div>
      </ThemeProvider>
    </SessionProvider>
  )
}
