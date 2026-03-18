import {
  IsString,
  IsInt,
  IsEnum,
  IsOptional,
  Min,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseLevel, Status } from '@prisma/client';

export class CreateCourseDto {
  @ApiProperty({
    description: 'Course name',
    example: 'Frontend React',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Course duration in months',
    example: 6,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  durationMonth: number;

  @ApiProperty({
    description: 'Total lesson count in course plan',
    example: 48,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  durationLesson: number;

  @ApiPropertyOptional({
    description: 'Course level',
    enum: CourseLevel,
    example: CourseLevel.INTERMEDIATE,
  })
  @IsEnum(CourseLevel)
  @IsOptional()
  level?: CourseLevel;

  @ApiProperty({
    description: 'Course price',
    example: 1200000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Course short description',
    example: 'React, routing va state management amaliyotlari',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Course status',
    enum: Status,
    example: Status.ACTIVE,
  })
  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}
