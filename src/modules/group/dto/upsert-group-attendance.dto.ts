import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional } from 'class-validator';

export class UpsertGroupAttendanceDto {
  @ApiProperty({ description: 'Student ID in the group', example: 10 })
  @IsInt()
  studentId: number;

  @ApiProperty({
    description: 'Attendance date in ISO format',
    example: '2026-03-30',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Whether student is present on that date',
    example: true,
  })
  @IsBoolean()
  isPresent: boolean;

  @ApiPropertyOptional({
    description: 'Admin/User ID making this attendance update',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  userId?: number;
}
