/**
 * Foundation Worker Template
 * Basic Cloudflare Worker with health checks, routing, and error handling
 * Based on medical research platform production patterns
 */

import { Router } from 'itty-router';

const router = Router({
  catch(error, request, env, ctx) {
    console.error('Worker error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});

// Health check endpoint
router.get('/health', () => {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Date.now() - globalThis.startTime
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

// Basic info endpoint
router.get('/', () => {
  return new Response(JSON.stringify({
    service: 'Cloudflare Foundation Worker',
    description: 'Basic worker template for learning Cloudflare platform',
    endpoints: {
      health: '/health',
      info: '/',
      echo: '/echo/:message'
    },
    documentation: 'Check worker logs for debugging info'
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

// Echo endpoint for testing
router.get('/echo/:message', (request) => {
  const { message } = request.params;
  return new Response(JSON.stringify({
    echo: message,
    received_at: new Date().toISOString(),
    user_agent: request.headers.get('user-agent'),
    cf_ray: request.headers.get('cf-ray')
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

// POST test endpoint
router.post('/test', async (request) => {
  try {
    const body = await request.json();
    return new Response(JSON.stringify({
      success: true,
      received: body,
      processed_at: new Date().toISOString(),
      request_method: request.method,
      content_type: request.headers.get('content-type')
    }), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Invalid JSON',
      message: error.message
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

// Handle CORS preflight
router.options('*', () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
});

// Default 404 handler
router.all('*', () => {
  return new Response(JSON.stringify({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    available_endpoints: ['/health', '/', '/echo/:message', '/test']
  }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

// Initialize global start time for uptime tracking
globalThis.startTime = Date.now();

export default {
  async fetch(request, env, ctx) {
    // Log all requests for debugging
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);

    // Add request ID for tracing
    request.requestId = crypto.randomUUID();
    request.headers.set('X-Request-ID', request.requestId);

    // Route the request
    return router.handle(request, env, ctx);
  }
};