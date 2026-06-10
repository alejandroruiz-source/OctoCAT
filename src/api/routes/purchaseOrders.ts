import { FastifyPluginAsync, FastifyReply } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { type DrizzleDB } from '../../lib/db/client'
import * as poService from '../../lib/services/poService'
import { InvalidStatusTransitionError, ForbiddenTransitionError } from '../../lib/services/stateMachine'
import {
  CreatePurchaseOrderRequest,
  UpdatePurchaseOrderRequest,
  SubmitPurchaseOrderRequest,
  PurchaseOrderResponse,
  LockResponse,
  StatusHistoryEntry,
  PurchaseOrderListResponse,
} from '../../lib/models/purchaseOrder'

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
      return reply.code(404).send({ error: 'NOT_FOUND', message: e.message })
    case 'PO_LOCKED':
      return reply.code(409).send({ error: 'CONFLICT', message: e.message })
    case 'NO_LINE_ITEMS':
    case 'MISSING_DELIVERY_DATE':
      return reply.code(422).send({ error: 'UNPROCESSABLE', message: e.message })
    default:
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' })
  }
}

const purchaseOrderRoutes: FastifyPluginAsync<RouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>()
  const { db } = opts

  // POST /purchase-orders
  app.post('/purchase-orders', {
    schema: {
      tags: ['purchase-orders'],
      body: CreatePurchaseOrderRequest,
      response: { 201: PurchaseOrderResponse },
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.authUser
      const po = poService.create(db, {
        supplierId: request.body.supplierId,
        branchId: request.body.branchId,
        buyerId: userId,
        expectedDeliveryDate: request.body.expectedDeliveryDate,
        notes: request.body.notes,
      })
      return reply.code(201).send(po)
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // GET /purchase-orders
  app.get('/purchase-orders', {
    schema: {
      tags: ['purchase-orders'],
      querystring: Type.Object({
        status: Type.Optional(Type.Array(Type.String())),
        supplierId: Type.Optional(Type.String()),
        page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
      }),
      response: { 200: PurchaseOrderListResponse },
    },
  }, async (request, reply) => {
    try {
      const { userId, role } = request.authUser
      const result = poService.list(db, {
        userId,
        role,
        status: request.query.status,
        supplierId: request.query.supplierId,
        page: request.query.page,
        limit: request.query.limit,
      })
      return reply.send(result)
    } catch (err) {
      return mapError(reply, err)
    }
  })

  const LineItemSchema = Type.Object({
    id: Type.String(),
    purchaseOrderId: Type.String(),
    lineNumber: Type.Integer(),
    productId: Type.String(),
    productName: Type.String(),
    quantity: Type.Integer(),
    unitPriceCents: Type.Integer(),
    extendedPriceCents: Type.Integer(),
  })

  const PODetailResponse = Type.Object({
    ...PurchaseOrderResponse.properties,
    lineItems: Type.Array(LineItemSchema),
    statusHistory: Type.Array(StatusHistoryEntry),
  })

  const ErrorResponse = Type.Object({ error: Type.String(), message: Type.String() })

  // GET /purchase-orders/:poId
  app.get('/purchase-orders/:poId', {
    schema: {
      tags: ['purchase-orders'],
      params: Type.Object({ poId: Type.String() }),
      response: { 200: PODetailResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    try {
      const { userId, role } = request.authUser
      const po = poService.getById(db, request.params.poId, userId, role)
      if (!po) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Purchase order not found' })
      }
      return reply.send({
        ...po,
        lineItems: po.lineItems ?? [],
        statusHistory: po.statusHistory ?? [],
      })
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // PATCH /purchase-orders/:poId
  app.patch('/purchase-orders/:poId', {
    schema: {
      tags: ['purchase-orders'],
      params: Type.Object({ poId: Type.String() }),
      body: UpdatePurchaseOrderRequest,
      response: { 200: PurchaseOrderResponse },
    },
  }, async (request, reply) => {
    try {
      const { userId, role } = request.authUser
      const po = poService.update(db, request.params.poId, request.body, userId, role)
      return reply.send(po)
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // POST /purchase-orders/:poId/cancel
  app.post('/purchase-orders/:poId/cancel', {
    schema: {
      tags: ['purchase-orders'],
      params: Type.Object({ poId: Type.String() }),
      response: { 200: PurchaseOrderResponse },
    },
  }, async (request, reply) => {
    try {
      const { userId, role } = request.authUser
      const po = poService.cancel(db, request.params.poId, userId, role)
      return reply.send(po)
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // POST /purchase-orders/:poId/submit
  app.post('/purchase-orders/:poId/submit', {
    schema: {
      tags: ['purchase-orders'],
      params: Type.Object({ poId: Type.String() }),
      body: Type.Optional(Type.Object({
        expectedDeliveryDate: Type.Optional(Type.String({ format: 'date' })),
      })),
      response: { 200: PurchaseOrderResponse },
    },
  }, async (request, reply) => {
    try {
      const { userId, role } = request.authUser
      const po = poService.submit(
        db,
        request.params.poId,
        userId,
        role,
        request.body?.expectedDeliveryDate,
      )
      return reply.send(po)
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // POST /purchase-orders/:poId/lock
  app.post('/purchase-orders/:poId/lock', {
    schema: {
      tags: ['purchase-orders'],
      params: Type.Object({ poId: Type.String() }),
      response: { 200: LockResponse },
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.authUser
      const result = poService.acquireLock(db, request.params.poId, userId)
      return reply.send(result)
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // DELETE /purchase-orders/:poId/lock
  app.delete('/purchase-orders/:poId/lock', {
    schema: {
      tags: ['purchase-orders'],
      params: Type.Object({ poId: Type.String() }),
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.authUser
      poService.releaseLock(db, request.params.poId, userId)
      return reply.code(204).send()
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // POST /purchase-orders/:poId/fulfill
  app.post('/purchase-orders/:poId/fulfill', {
    schema: {
      tags: ['purchase-orders'],
      params: Type.Object({ poId: Type.String() }),
      response: { 200: PurchaseOrderResponse },
    },
  }, async (request, reply) => {
    try {
      const { userId, role } = request.authUser
      const po = poService.fulfill(db, request.params.poId, userId, role)
      return reply.send(po)
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // GET /purchase-orders/:poId/history
  app.get('/purchase-orders/:poId/history', {
    schema: {
      tags: ['purchase-orders'],
      params: Type.Object({ poId: Type.String() }),
      response: { 200: Type.Array(StatusHistoryEntry) },
    },
  }, async (request, reply) => {
    try {
      const history = poService.getHistory(db, request.params.poId)
      return reply.send(history)
    } catch (err) {
      return mapError(reply, err)
    }
  })
}

export { purchaseOrderRoutes }
