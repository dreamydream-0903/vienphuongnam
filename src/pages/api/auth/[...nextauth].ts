// pages/api/auth/[...nextauth].ts
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions } from 'next-auth'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // 4) only allow sign-in if user already exists in your User table
    async signIn({ user, account, profile }) {
      // 1) If no account object (should never happen with OAuth), block.
      if (!account) return false

      const { provider, providerAccountId } = account

      // 2) Does an Account already exist?
      const existingAcct = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          }
        }
      })
      if (existingAcct) {
        // account already linked → allow sign in
        return true
      }

      // 3) Otherwise, look up an existing User by email
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email! }
      })
      if (!existingUser) {
        // new user not in your whitelist → block
        return false
      }

      // 4) Create the Account record to link Google → your User
      await prisma.account.create({
        data: {
          userId:             existingUser.id,
          type:               account.type,
          provider:           account.provider,
          providerAccountId:  account.providerAccountId,
          refresh_token:      account.refresh_token,
          access_token:       account.access_token,
          expires_at:         account.expires_at,
          token_type:         account.token_type,
          scope:              account.scope,
          id_token:           account.id_token,
          session_state:      account.session_state,
        }
      })

      // now that it’s linked, allow sign in
      return true
    },

    // 5) include email in the JWT so we can verify it in the license endpoint
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email
      return token
    },

    async session({ session, token }) {
      if (token?.email) session.user!.email = token.email as string
      return session
    },
  },
}

export default NextAuth(authOptions)
