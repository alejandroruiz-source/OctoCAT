import Fastify, { FastifyInstance } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import cors from '@fastify/cors'
import authPlugin, { type AuthPluginOptions } from './plugins/auth'
import swaggerPlugin from './plugins/swagger'
import { type DrizzleDB } from '../lib/db/client'

export interface AppOptions {
  /** Pass testMode: true in tests to use header-based auth instead of JWT */
  auth?: AuthPluginOptions
  logger?: boolean
}

export async function buildApp(db: DrizzleDB, opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false }).withTypeProvider<TypeBoxTypeProvider>()

  // Store db on fastify instance for route access
  app.decorate('db', db)

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
  await app.register(swaggerPlugin)
  await app.register(authPlugin, opts.auth ?? {})

  const { purchaseOrderRoutes } = await import('./routes/purchaseOrders')
  const { lineItemRoutes } = await import('./routes/lineItems')
  const { approvalRoutes } = await import('./routes/approvals')
  await app.register(purchaseOrderRoutes, { prefix: '/api/v1', db })
  await app.register(lineItemRoutes, { prefix: '/api/v1', db })
  await app.register(approvalRoutes, { prefix: '/api/v1', db })

  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    db: DrizzleDB
  }
}
