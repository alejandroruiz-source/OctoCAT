import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { type UserRole } from '../../lib/services/stateMachine'

export interface AuthUser {
  userId: string
  role: UserRole
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser
  }
}

export interface AuthPluginOptions {
  /** In test mode, accept x-test-user-id and x-test-user-role headers instead of JWT */
  testMode?: boolean
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, opts) => {
  fastify.decorateRequest('authUser', null as unknown as AuthUser)

  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
    if (opts.testMode) {
      const userId = request.headers['x-test-user-id'] as string
      const role = request.headers['x-test-user-role'] as string
      if (!userId || !role) {
        reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing test auth headers' })
        return
      }
      if (!['BUYER', 'SUPPLIER', 'APPROVER'].includes(role)) {
        reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid role' })
        return
      }
      request.authUser = { userId, role: role as UserRole }
      return
    }

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing Bearer token' })
      return
    }
    const token = authHeader.slice(7)
    try {
      // Simple base64-encoded JSON token for MVP (replace with real JWT in production)
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
      if (!decoded.userId || !decoded.role) {
        throw new Error('Missing claims')
      }
      request.authUser = { userId: decoded.userId, role: decoded.role as UserRole }
    } catch {
      reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid token' })
    }
  })
}

export default fp(authPlugin, { name: 'auth' })
