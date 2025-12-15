import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

export interface JwtPayload {
  walletAddress: string;
  sub: string;
  iat: number;
  exp: number;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { user: JwtPayload }>();
    const user: JwtPayload = request.user;

    if (data) {
      return user[data];
    }

    return user;
  },
);
