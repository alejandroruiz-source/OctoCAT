import { FastifyPluginAsync, FastifyReply } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { type DrizzleDB } from '../../lib/db/client'
import * as approvalService from '../../lib/services/approvalService'
import { InvalidStatusTransitionError, ForbiddenTransitionError } from '../../lib/services/stateMachine'
import { RejectPurchaseOrderRequest, ApprovalResponse } from '../../lib/models/approval'

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
  const e = err as Error & { code?: string; message: string }
  switch (e.message) {
    case 'PO_NOT_FOUND':
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Purchase order not found' })
    case 'REASON_REQUIRED':
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Rejection reason is required' })
    default:
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' })
  }
}

const approvalRoutes: FastifyPluginAsync<RouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>()
  const { db } = opts

  // POST /purchase-orders/:poId/approve
  app.post('/purchase-orders/:poId/approve', {
    schema: {
      tags: ['approvals'],
      params: Type.Object({ poId: Type.String() }),
      response: {
        200: Type.Object({
          id: Type.String(),
          purchaseOrderId: Type.String(),
          approverId: Type.String(),
          decision: Type.Literal('APPROVED'),
          reason: Type.Union([Type.String(), Type.Null()]),
          decidedAt: Type.String({ format: 'date-time' }),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { userId, role } = request.authUser
      const approval = approvalService.approve(db, request.params.poId, userId, role)
      return reply.send({
        ...approval,
        decidedAt: new Date(approval.decidedAt).toISOString(),
      })
    } catch (err) {
      return mapError(reply, err)
    }
  })

  // POST /purchase-orders/:poId/reject
  app.post('/purchase-orders/:poId/reject', {
    schema: {
      tags: ['approvals'],
      params: Type.Object({ poId: Type.String() }),
      body: RejectPurchaseOrderRequest,
      response: {
        200: Type.Object({
          id: Type.String(),
          purchaseOrderId: Type.String(),
          approverId: Type.String(),
          decision: Type.Literal('REJECTED'),
          reason: Type.Union([Type.String(), Type.Null()]),
          decidedAt: Type.String({ format: 'date-time' }),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const { userId, role } = request.authUser
      const approval = approvalService.reject(db, request.params.poId, userId, role, request.body.reason)
      return reply.send({
        ...approval,
        decidedAt: new Date(approval.decidedAt).toISOString(),
      })
    } catch (err) {
      return mapError(reply, err)
    }
  })
}

export { approvalRoutes }
