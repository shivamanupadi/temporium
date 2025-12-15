import { Controller, Get, Req, Res, Logger } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';

const TOKENLIST_BASE_URL = 'https://tokenlist.tempo.xyz';

@Controller({ path: 'tokenlist', version: '' })
export class TokenlistController {
  private readonly logger = new Logger(TokenlistController.name);

  @Get('*')
  async proxy(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    // Build target URL from request path
    // Fastify uses req.url which includes the full path
    const fullPath = req.url.split('?')[0];
    const path = fullPath.replace('/tokenlist', '') || '/';
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    const targetUrl = `${TOKENLIST_BASE_URL}${path}${queryString ? '?' + queryString : ''}`;

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.text();

      res.headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      });

      await res.status(response.status).send(data);
    } catch (error) {
      this.logger.error('Tokenlist proxy error:', error);
      await res.status(502).send({ error: 'Failed to fetch tokenlist' });
    }
  }
}
