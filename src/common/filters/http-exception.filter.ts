import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger, } from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';
import { Prisma } from '@prisma/client';
type HttpExceptionPayload = {
    message?: string | string[];
    error?: string;
};
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);
    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let error = 'Internal Server Error';
        if (exception instanceof HttpException) {
            const httpError = this.extractHttpExceptionDetails(exception);
            status = httpError.statusCode;
            message = httpError.message;
            error = httpError.error;
        }
        else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            const prismaError = this.handlePrismaError(exception);
            status = prismaError.statusCode;
            message = prismaError.message;
            error = prismaError.error;
        }
        else if (this.isPayloadTooLargeError(exception)) {
            const payloadError = this.handlePayloadTooLargeError(exception);
            status = payloadError.statusCode;
            message = payloadError.message;
            error = payloadError.error;
        }
        else if (exception instanceof Error) {
            message = exception.message;
        }
        const errorResponse = {
            success: false,
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
            error,
        };
        if (status >= 500) {
            this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
        }
        response.status(status).json(errorResponse);
    }
    private extractHttpExceptionDetails(exception: HttpException) {
        const statusCode = exception.getStatus();
        const response = exception.getResponse();
        if (typeof response === 'string') {
            return {
                statusCode,
                message: response,
                error: exception.name,
            };
        }
        const payload = response as HttpExceptionPayload;
        return {
            statusCode,
            message: payload.message ?? exception.message ?? 'Request failed',
            error: payload.error ?? exception.name,
        };
    }
    private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError) {
        switch (exception.code) {
            case 'P2002':
                {
                    const target = Array.isArray(exception.meta?.target)
                        ? exception.meta?.target.join(', ')
                        : String(exception.meta?.target || 'field');
                    return {
                        statusCode: HttpStatus.CONFLICT,
                        message: `Duplicate field value: ${target}`,
                        error: 'Conflict',
                    };
                }
            case 'P2025':
                return {
                    statusCode: HttpStatus.NOT_FOUND,
                    message: 'Record not found',
                    error: 'Not Found',
                };
            case 'P2003':
                return {
                    statusCode: HttpStatus.BAD_REQUEST,
                    message: 'Invalid input data',
                    error: 'Bad Request',
                };
            default:
                return {
                    statusCode: HttpStatus.BAD_REQUEST,
                    message: exception.message,
                    error: 'Bad Request',
                };
        }
    }

    private isPayloadTooLargeError(exception: unknown) {
        if (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE') {
            return true;
        }

        if (!(exception instanceof Error)) {
            return false;
        }

        const maybeRequestSizeError = exception as Error & {
            status?: number;
            statusCode?: number;
            type?: string;
            code?: string;
        };

        return (
            maybeRequestSizeError.status === HttpStatus.PAYLOAD_TOO_LARGE ||
            maybeRequestSizeError.statusCode === HttpStatus.PAYLOAD_TOO_LARGE ||
            maybeRequestSizeError.type === 'entity.too.large' ||
            maybeRequestSizeError.code === 'LIMIT_FILE_SIZE'
        );
    }

    private handlePayloadTooLargeError(exception: unknown) {
        if (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE') {
            return {
                statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
                message: 'Yuklanayotgan fayl hajmi ruxsat etilgan limitdan katta',
                error: 'Payload Too Large',
            };
        }

        const payloadError = exception as Error & { message?: string };

        return {
            statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
            message:
                payloadError.message ||
                "So'rov hajmi ruxsat etilgan limitdan katta",
            error: 'Payload Too Large',
        };
    }
}
