import { HomeworkStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReviewHomeworkDto {
  @ApiProperty({ description: 'Homework ID', example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  homeworkId: number;

  @ApiProperty({ description: 'Student ID', example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId: number;

  @ApiProperty({
    description: 'Score from 0 to 100',
    example: 92,
    minimum: 0,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @ApiProperty({
    description: 'Review result status',
    enum: HomeworkStatus,
    example: HomeworkStatus.APPROVED,
  })
  @IsEnum(HomeworkStatus)
  status: HomeworkStatus;

  @ApiPropertyOptional({
    description: 'Optional reviewer feedback',
    example: 'State va effectlar toza ishlatilgan.',
  })
  @IsString()
  @IsOptional()
  feedback?: string;
}
