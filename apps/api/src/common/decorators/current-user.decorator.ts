import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  walletAddress: string;
  sub: string;
  iat: number;
  exp: number;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (data) {
      return user[data] as string | number;
    }

    return user;
  },
);
