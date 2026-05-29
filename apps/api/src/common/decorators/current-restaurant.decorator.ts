import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentRestaurant = createParamDecorator((_: unknown, ctx: ExecutionContext): string =>
  ctx.switchToHttp().getRequest().restaurant_id);
