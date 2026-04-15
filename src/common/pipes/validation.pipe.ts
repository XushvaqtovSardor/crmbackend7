import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException, } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ValidationError } from 'class-validator';
@Injectable()
export class ValidationPipe implements PipeTransform<any> {
    async transform(value: any, { metatype }: ArgumentMetadata) {
        if (!metatype || !this.shouldValidate(metatype)) {
            return value;
        }
        const object = plainToInstance(metatype, value);
        const errors = await validate(object, {
            whitelist: true,
            forbidNonWhitelisted: true,
            validationError: {
                target: false,
            },
        });
        if (errors.length > 0) {
            const messages = this.formatErrors(errors);
            throw new BadRequestException({
                message: 'Validation failed',
                errors: messages,
            });
        }
        return object;
    }
    private shouldValidate(metatype: Function): boolean {
        const types: Function[] = [String, Boolean, Number, Array, Object];
        return !types.includes(metatype);
    }
    private formatErrors(errors: ValidationError[], parentPath = ''): Array<{
        field: string;
        errors: string[];
    }> {
        const formatted: Array<{
            field: string;
            errors: string[];
        }> = [];
        for (const error of errors) {
            const fieldPath = parentPath
                ? `${parentPath}.${error.property}`
                : error.property;
            const constraints = Object.values(error.constraints || {});
            if (constraints.length > 0) {
                formatted.push({
                    field: fieldPath,
                    errors: constraints,
                });
            }
            if (error.children?.length) {
                formatted.push(...this.formatErrors(error.children, fieldPath));
            }
        }
        return formatted;
    }
}
