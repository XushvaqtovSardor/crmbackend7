import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ROLES } from './roles.decorator';

type JwtPayload = {
  sub: number;
  role: Role;
};

type GuardRequest = {
  headers: Record<string, unknown>;
  user?: JwtPayload;
};

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

    const request = context.switchToHttp().getRequest<GuardRequest>();
    const token = this.getTokenFromHeader(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException(
        'Authorization: Bearer <token> is required',
      );
    }

    const payload = this.verifyToken(token);
    request.user = payload;
    request.headers['x-user-id'] = String(payload.sub);
    request.headers['x-user-role'] = payload.role;

    if (!requiredRoles.includes(payload.role)) {
      throw new ForbiddenException(
        'You do not have permission for this resource',
      );
    }

    return true;
  }

  private verifyToken(token: string): JwtPayload {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        algorithms: ['HS256'],
        secret: process.env.JWT_SECRET || 'dev-secret',
      });

      if (
        !Number.isInteger(payload.sub) ||
        !Object.values(Role).includes(payload.role)
      ) {
        throw new UnauthorizedException('Invalid token payload');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private getTokenFromHeader(authHeader: unknown): string | null {
    const value = String(authHeader ?? '').trim();

    if (!value.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    return value.slice(7).trim() || null;
  }
}