import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({ description: 'Full name', example: 'Aziza Karimova' })
    @IsString()
    fullName!: string;

    @ApiPropertyOptional({ description: 'Email address', example: 'teacher@edu.uz' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ description: 'Phone number', example: '+998901234567' })
    @Matches(/^\+?[1-9]\d{8,14}$/)
    @IsOptional()
    phone?: string;

    @ApiProperty({ description: 'Password', minLength: 6, example: 'secure123' })
    @IsString()
    @MinLength(6)
    password!: string;

    @ApiPropertyOptional({ description: 'Profile photo URL', example: 'https://cdn.example.com/profile.jpg' })
    @IsString()
    @IsOptional()
    photo?: string;

    @ApiProperty({ description: 'Birth date in ISO format', example: '2006-05-12', format: 'date' })
    @IsDateString()
    birthDate!: string;

    @ApiPropertyOptional({
        description: 'Deprecated for public register. Any provided value is normalized to STUDENT.',
        enum: ['STUDENT'],
        default: 'STUDENT',
    })
    @Transform(() => 'STUDENT', { toClassOnly: true })
    @IsOptional()
    @IsIn(['STUDENT'])
    role?: 'STUDENT';
}
