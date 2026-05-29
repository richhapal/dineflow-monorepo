import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
@Injectable()
export class RestaurantGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) throw new ForbiddenException('Not authenticated');
    // Internal users can impersonate any restaurant
    if (req.user.internal_role) {
      req.restaurant_id = req.params.restaurantId || req.headers['x-restaurant-id'] || req.body?.restaurant_id;
      return true;
    }
    // Restaurant users scoped to their own restaurant
    req.restaurant_id = req.user.restaurant_id;
    return true;
  }
}
