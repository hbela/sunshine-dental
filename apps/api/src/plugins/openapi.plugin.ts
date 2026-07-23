import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { clinic } from '../lib/clinic.js';

async function openapiPlugin(fastify: FastifyInstance) {
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  await fastify.register(fastifySwagger, {
    openapi: {
      info: { title: `${clinic.fullName} API`, version: '1.0.0' },
      components: {
        securitySchemes: {
          cookieAuth: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token' },
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/documentation'
  });
}

export default fp(openapiPlugin);
