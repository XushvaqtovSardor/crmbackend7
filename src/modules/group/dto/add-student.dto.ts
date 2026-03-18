import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddStudentToGroupDto {
  @ApiProperty({ description: 'Student ID to add', example: 10 })
  @IsInt()
  studentId: number;

  @ApiProperty({ description: 'Admin/User ID making assignment', example: 2 })
  @IsInt()
  userId: number;
}
