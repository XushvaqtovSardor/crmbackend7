import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLessonDto {
  @ApiProperty({ description: 'Group ID', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  groupId: number;

  @ApiProperty({ description: 'Lesson title', example: 'React asoslari' })
  @IsString()
  @IsNotEmpty()
  title: string;
}
