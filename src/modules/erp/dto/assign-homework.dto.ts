import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min, } from 'class-validator';
export class AssignHomeworkDto {
    @ApiProperty({ description: 'Lesson ID', example: 1, minimum: 1 })
    @IsInt()
    @Min(1)
    lessonId: number;
    @ApiProperty({ description: 'Homework title', example: 'Hooks amaliyoti' })
    @IsString()
    @IsNotEmpty()
    title: string;
    @ApiPropertyOptional({
        description: 'Attachment URL',
        example: 'https://cdn.example.com/homeworks/hooks.pdf',
    })
    @IsString()
    @IsOptional()
    file?: string;
    @ApiProperty({
        description: 'Homework estimated duration in hours',
        example: 16,
        minimum: 1,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    durationTime: number;
    @ApiProperty({
        description: 'Submission deadline in ISO datetime',
        example: '2026-03-25T18:00:00.000Z',
    })
    @IsDateString()
    deadlineAt: string;
    @ApiPropertyOptional({
        description: 'Maximum submission attempts',
        example: 2,
        minimum: 1,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    maxAttempts?: number;
    @ApiPropertyOptional({
        description: 'Allow late submission after deadline',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    allowLateSubmission?: boolean;
}
