import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

const TOKENLIST_BASE_URL = 'https://tokenlist.tempo.xyz';

@Controller('tokenlist')
export class TokenlistController {
  @Get('*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    // Build target URL from request path
    const path = req.path.replace('/tokenlist', '') || '/';
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    const targetUrl = `${TOKENLIST_BASE_URL}${path}${queryString ? '?' + queryString : ''}`;

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.text();

      res.set({
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      });

      res.status(response.status).send(data);
    } catch (error) {
      console.error('Tokenlist proxy error:', error);
      res.status(502).json({ error: 'Failed to fetch tokenlist' });
    }
  }
}
