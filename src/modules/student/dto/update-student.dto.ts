import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateStudentDto } from './create-student.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @ApiPropertyOptional({
    description: 'New student password',
    minLength: 6,
    example: 'newpass123',
  })
  @IsString()
  @IsOptional()
  password?: string;
}
