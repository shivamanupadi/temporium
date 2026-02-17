import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';

import authRouter from './auth';
import projectsRouter from './projects';
import contractsRouter from './contracts';
import templatesRouter from './templates';

const routes = new Hono<{ Bindings: Env; Variables: Variables }>();

routes.route('/auth', authRouter);
routes.route('/v1/projects', projectsRouter);
routes.route('/v1/contracts', contractsRouter);
routes.route('/v1/templates', templatesRouter);

export default routes;
