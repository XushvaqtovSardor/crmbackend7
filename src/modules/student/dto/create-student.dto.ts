import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class CreateStudentDto {
  @ApiProperty({
    description: 'Student full name',
    example: 'Sardor Xushvaqtov',
  })
  @IsString()
  fullName: string;

  @ApiProperty({
    description: 'Student email address',
    example: 'student@edu.uz',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Phone number in international format for SMS',
    example: '+998901234567',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Profile image URL',
    example: 'https://cdn.example.com/avatar.jpg',
  })
  @IsString()
  @IsOptional()
  photo?: string;

  @ApiProperty({
    description: 'Student account password',
    minLength: 6,
    example: 'student123',
  })
  @IsString()
  password: string;

  @ApiProperty({
    description: 'Birth date in ISO format',
    example: '2006-05-12',
    format: 'date',
  })
  @IsDateString()
  birth_date: string;

  @ApiPropertyOptional({
    description: 'Student status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
