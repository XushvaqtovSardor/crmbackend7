import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsEnum,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeacherDto {
  @ApiProperty({ description: 'Teacher full name', example: 'Aziza Karimova' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ description: 'Teacher email', example: 'teacher@edu.uz' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: 'Phone number in international format for SMS',
    example: '+998901234567',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Teacher profile image URL',
    example: 'https://cdn.example.com/teacher.jpg',
  })
  @IsString()
  @IsOptional()
  photo?: string;

  @ApiProperty({
    description: 'Teacher password',
    minLength: 6,
    example: 'teacher123',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'Teacher position', example: 'Frontend Mentor' })
  @IsString()
  @IsNotEmpty()
  position: string;

  @ApiProperty({
    description: 'Years of teaching experience',
    example: 5,
  })
  @IsInt()
  @IsNotEmpty()
  experience: number;

  @ApiPropertyOptional({
    description: 'Teacher status',
    enum: ['ACTIVE', 'INACTIVE', 'FREEZE'],
    example: 'ACTIVE',
  })
  @IsEnum(['ACTIVE', 'INACTIVE', 'FREEZE'])
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE' | 'FREEZE';
}
