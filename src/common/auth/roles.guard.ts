import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ROLES } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    let roleHeader = String(request.headers['x-user-role'] || '').toUpperCase();

    if (!roleHeader) {
      const authHeader = String(request.headers.authorization || '');
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : '';

      if (token) {
        try {
          const payload = this.jwtService.verify<{
            sub: number;
            role: Role;
          }>(token, {
            secret: process.env.JWT_SECRET || 'dev-secret',
          });

          roleHeader = payload.role;
          request.headers['x-user-id'] = String(payload.sub);
          request.headers['x-user-role'] = payload.role;
        } catch {
          throw new ForbiddenException('Invalid or expired bearer token');
        }
      }
    }

    if (!Object.values(Role).includes(roleHeader as Role)) {
      throw new ForbiddenException(
        'Provide x-user-role header or Authorization: Bearer <token>',
      );
    }

    if (!requiredRoles.includes(roleHeader as Role)) {
      throw new ForbiddenException(
        'You do not have permission for this resource',
      );
    }

    return true;
  }
}
