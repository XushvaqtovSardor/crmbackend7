import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  /** Wraps every successful handler result into the shared API success envelope. */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    // Centralizing shape here keeps controllers focused on business logic only.
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        message: data?.message || 'Operation successful',
      })),
    );
  }
}
