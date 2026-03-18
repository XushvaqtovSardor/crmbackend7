import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitHomeworkDto {
  @ApiProperty({ description: 'Homework ID', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  homeworkId: number;

  @ApiProperty({
    description: 'Submission title',
    example: 'Todo app with hooks',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Submission file URL',
    example: 'https://cdn.example.com/submissions/todo-hooks.zip',
  })
  @IsString()
  @IsOptional()
  file?: string;
}
