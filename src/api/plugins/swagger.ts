import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Purchase Order Management API',
        version: '1.0.0',
        description: 'OctoCAT Purchase Order Management System — REST API',
      },
      servers: [{ url: '/api/v1' }],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ BearerAuth: [] }],
      tags: [
        { name: 'purchase-orders', description: 'PO lifecycle management' },
        { name: 'line-items', description: 'Line items within a PO' },
        { name: 'approvals', description: 'Approve or reject high-value POs' },
      ],
    },
  })

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list' },
  })
}

export default fp(swaggerPlugin, { name: 'swagger' })
