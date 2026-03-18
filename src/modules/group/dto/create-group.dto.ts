import {
  IsString,
  IsInt,
  IsDateString,
  IsEnum,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status, WeekDays } from '@prisma/client';

export class CreateGroupDto {
  @ApiProperty({ description: 'Teacher ID', example: 1 })
  @IsInt()
  teacherId: number;

  @ApiProperty({ description: 'Admin/User ID creating group', example: 2 })
  @IsInt()
  userId: number;

  @ApiProperty({ description: 'Room ID for this group', example: 1 })
  @IsInt()
  roomId: number;

  @ApiProperty({ description: 'Course ID linked to group', example: 1 })
  @IsInt()
  courseId: number;

  @ApiProperty({ description: 'Group name', example: 'Frontend N25' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Group start date in ISO format',
    example: '2026-03-01',
    format: 'date',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Start time', example: '18:30' })
  @IsString()
  startTime: string;

  @ApiProperty({
    description: 'Lesson weekdays',
    enum: WeekDays,
    isArray: true,
    example: [WeekDays.MONDAY, WeekDays.WEDNESDAY, WeekDays.FRIDAY],
  })
  @IsArray()
  @IsEnum(WeekDays, { each: true })
  weekDays: WeekDays[];

  @ApiPropertyOptional({
    description: 'Group status',
    enum: Status,
    example: Status.ACTIVE,
  })
  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}
