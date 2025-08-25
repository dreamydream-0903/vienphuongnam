// // src/components/AdminLayout.tsx
// 'use client'

// import React, { ReactNode } from 'react'
// import Link from 'next/link'
// import { usePathname } from 'next/navigation'
// import {
//   NavigationMenu,
//   NavigationMenuList,
//   NavigationMenuItem,
//   NavigationMenuLink,
//   navigationMenuTriggerStyle,
// } from '@/components/ui/navigation-menu'

// interface AdminLayoutProps {
//   children: ReactNode
// }

// const navItems = [
//   { label: 'Dashboard',     href: '/admin' },
//   { label: 'Users',         href: '/admin/users' },
//   { label: 'Courses',       href: '/admin/courses' },
//   { label: 'Watch Counter', href: '/admin/watch-counter' },
//   { label: 'Video Keys',    href: '/admin/keys' },
//   { label: 'Watch Time',    href: '/admin/watch-time' },
// ]

// export default function AdminLayout({ children }: AdminLayoutProps) {
//   const pathname = usePathname() || ''

//   return (
//     <div className="min-h-screen flex flex-col bg-background">
//       <header className="border-b bg-background">
//         <div className="container mx-auto flex items-center justify-between px-6 py-4">
//           <h1 className="text-2xl font-bold">Admin Panel</h1>

//           <NavigationMenu viewport={false}>
//             <NavigationMenuList className="list-none m-0 p-1 flex space-x-2 bg-muted/50 rounded-lg shadow-sm">
//               {navItems.map((item) => {
//                 const isActive = pathname.startsWith(item.href)
//                 return (
//                   <NavigationMenuItem key={item.href}>
//                     <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
//                       <Link
//                         href={item.href}
//                         className={`
//                           inline-flex items-center justify-center
//                           px-4 py-2 text-sm font-medium rounded-md
//                           transition
//                           ${isActive
//                             ? 'bg-muted text-muted-foreground'
//                             : 'text-foreground hover:bg-muted/20'}
//                         `}
//                       >
//                         {item.label}
//                       </Link>
//                     </NavigationMenuLink>
//                   </NavigationMenuItem>
//                 )
//               })}
//             </NavigationMenuList>
//           </NavigationMenu>
//         </div>
//       </header>

//       <main className="flex-1 container mx-auto p-6">
//         {children}
//       </main>
//     </div>
//   )
// }

// src/components/AdminLayout.tsx
'use client'

import React, { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'

import { useRouter } from 'next/router'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { darkTheme } from '../theme'

interface AdminLayoutProps {
  children: ReactNode
}

const navItems = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Courses', href: '/admin/courses' },
  { label: 'Enrollments', href: '/admin/enrollments' },
  { label: 'Watch Counter', href: '/admin/watch-counter' },
  { label: 'Video Keys', href: '/admin/keys' },
  { label: 'Watch Time', href: '/admin/watch-time' },
]

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname() || ''

  const router = useRouter()
  // pull out session (for SessionProvider) and pass the rest to pages

  return (
    <ThemeProvider theme={darkTheme}>
      <div className="min-h-screen flex flex-col">
        <CssBaseline />
        <div className="min-h-screen flex flex-col">
          <header className="border-b">
            <div className="container mx-auto max-w-screen-2xl px-6 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold">Admin Panel</h1>

              <NavigationMenu viewport={false}>
                <NavigationMenuList className="flex gap-1 rounded-lg bg-muted/50 p-1 shadow-sm">
                  {navItems.map((item) => {
                    const isActive =
                      pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <NavigationMenuItem key={item.href}>
                        <NavigationMenuLink
                          asChild
                          data-active={isActive ? 'true' : undefined}
                          className={navigationMenuTriggerStyle()}>
                          <Link
                            href={item.href}
                            className="rounded-md px-4 py-2 no-underline"
                          >
                            {item.label}
                          </Link>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    )
                  })}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </header>

          <div className="flex-1 container mx-auto max-w-screen-2xl p-6">
            {children}
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
