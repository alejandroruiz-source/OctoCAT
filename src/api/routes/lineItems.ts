import { FastifyPluginAsync, FastifyReply } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { type DrizzleDB } from '../../lib/db/client'
import * as lineItemService from '../../lib/services/lineItemService'
import { InvalidStatusTransitionError, ForbiddenTransitionError } from '../../lib/services/stateMachine'
import { AddLineItemRequest, UpdateLineItemRequest, LineItemResponse } from '../../lib/models/lineItem'

interface RouteOptions {
  db: DrizzleDB
}

function mapError(reply: FastifyReply, err: unknown): ReturnType<FastifyReply['send']> {
  if (err instanceof ForbiddenTransitionError) {
    return reply.code(403).send({ error: 'FORBIDDEN', message: err.message })
  }
  if (err instanceof InvalidStatusTransitionError) {
    return reply.code(409).send({ error: 'CONFLICT', message: err.message })
  }
  const e = err as Error & { code?: string }
  switch (e.code) {
    case 'PO_NOT_FOUND':
    case 'LINE_ITEM_NOT_FOUND':
      return reply.code(404).send({ error: 'NOT_FOUND', message: e.message })
    case 'PO_LOCKED':
      return reply.code(409).send({ error: 'CONFLICT', message: e.message })
    default:
      if (e.message?.includes('cannot be edited') || e.message?.includes('status')) {
        return reply.code(409).send({ error: 'CONFLICT', message: e.message })
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' })
  }
}

const lineItemRoutes: FastifyPluginAsync<RouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>()
  const { db } = opts

  // POST /purchase-orders/:poId/line-items
  app.post('/purchase-orders/:poId/line-items', {
    schema: {
      tags: ['line-items'],
      params: Type.Object({ poId: Type.String() }),
      body: AddLineItemRequest,
      response: { 201: LineItemResponse },
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.authUser
      const item = lineItemService.add(db, request.params.poId, request.body, userId)
      return reply.code(201).send(item)
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // PATCH /purchase-orders/:poId/line-items/:lineItemId
  app.patch('/purchase-orders/:poId/line-items/:lineItemId', {
    schema: {
      tags: ['line-items'],
      params: Type.Object({ poId: Type.String(), lineItemId: Type.String() }),
      body: UpdateLineItemRequest,
      response: { 200: LineItemResponse },
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.authUser
      const item = lineItemService.update(db, request.params.poId, request.params.lineItemId, request.body, userId)
      return reply.send(item)
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // DELETE /purchase-orders/:poId/line-items/:lineItemId
  app.delete('/purchase-orders/:poId/line-items/:lineItemId', {
    schema: {
      tags: ['line-items'],
      params: Type.Object({ poId: Type.String(), lineItemId: Type.String() }),
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.authUser
      lineItemService.remove(db, request.params.poId, request.params.lineItemId, userId)
      return reply.code(204).send()
    } catch (err) {
      return mapError(reply, err)
    }
  })
}

export { lineItemRoutes }
