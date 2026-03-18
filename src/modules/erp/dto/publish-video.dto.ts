import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PublishVideoDto {
  @ApiProperty({ description: 'Lesson ID', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  lessonId: number;

  @ApiProperty({
    description: 'Video URL or file reference',
    example: 'https://cdn.example.com/videos/react-asoslari.mp4',
  })
  @IsString()
  @IsNotEmpty()
  file: string;
}
