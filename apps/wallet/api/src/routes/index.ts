import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';

import contactsRouter from './contacts';
import tip20Router from './tip20-studio';
import policiesRouter from './policies';
import scheduledTxsRouter from './scheduled-txs';
import customTokensRouter from './custom-tokens';
import tokenlistRouter from './tokenlist';
import authRouter from './auth';
import keysRouter from './keys';
import contractsRouter from './contracts';

const routes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Wallet API routes (merged from wallet worker)
routes.route('/auth', authRouter);
routes.route('/keys', keysRouter);
routes.route('/contracts', contractsRouter);

// API v1 routes
routes.route('/v1/contacts', contactsRouter);
routes.route('/v1/tip20-contracts', tip20Router);
routes.route('/v1/policies', policiesRouter);
routes.route('/v1/scheduled-transactions', scheduledTxsRouter);
routes.route('/v1/custom-tokens', customTokensRouter);

// Non-versioned routes
routes.route('/tokenlist', tokenlistRouter);

export default routes;
