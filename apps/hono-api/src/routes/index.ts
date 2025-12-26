import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';

import authRouter from './auth';
import keysRouter from './keys';
import contactsRouter from './contacts';
import tip20Router from './tip20-studio';
import policiesRouter from './policies';
import scheduledTxsRouter from './scheduled-txs';
import tokenlistRouter from './tokenlist';

const routes = new Hono<{ Bindings: Env; Variables: Variables }>();

// API v1 routes
routes.route('/v1/auth', authRouter);
routes.route('/v1/contacts', contactsRouter);
routes.route('/v1/tip20-contracts', tip20Router);
routes.route('/v1/policies', policiesRouter);
routes.route('/v1/scheduled-transactions', scheduledTxsRouter);

// Non-versioned routes
routes.route('/keys', keysRouter);
routes.route('/tokenlist', tokenlistRouter);

export default routes;
