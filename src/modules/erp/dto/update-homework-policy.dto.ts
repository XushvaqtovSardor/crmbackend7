import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateHomeworkPolicyDto {
  @ApiPropertyOptional({
    description: 'New deadline datetime in ISO format',
    example: '2026-03-28T18:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  deadlineAt?: string;

  @ApiPropertyOptional({
    description: 'New max attempts',
    example: 3,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxAttempts?: number;

  @ApiPropertyOptional({
    description: 'Allow late submissions',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  allowLateSubmission?: boolean;
}
