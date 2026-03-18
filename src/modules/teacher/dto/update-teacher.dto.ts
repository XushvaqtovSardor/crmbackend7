import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTeacherDto } from './create-teacher.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {
  @ApiPropertyOptional({
    description: 'New teacher password',
    minLength: 6,
    example: 'newteacher123',
  })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;
}
