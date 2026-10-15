import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getUser, type User } from '@netlify/identity'

export const isAdmin = (user: User | null) =>
  !!user &&
  ((user.roles ?? []).includes('admin') ||
    (
      (user.appMetadata?.authorization as { roles?: string[] } | undefined)
        ?.roles ?? []
    ).includes('admin'))

export const getServerUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await getUser()
    return user ? { email: user.email, isAdmin: isAdmin(user) } : null
  },
)

export const requireAdmin = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const user = await getUser()
    if (!isAdmin(user)) throw new Error('Admin access required')
    return next({ context: { user: user! } })
  },
)
