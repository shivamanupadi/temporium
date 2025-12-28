import { Hono } from 'hono';
import keysRouter from './keys';
import authRouter from './auth';
import contractsRouter from './contracts';
import type { Env, Variables } from '../types/env';

const routes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Mount routes
routes.route('/keys', keysRouter);
routes.route('/auth', authRouter);
routes.route('/contracts', contractsRouter);

export default routes;
