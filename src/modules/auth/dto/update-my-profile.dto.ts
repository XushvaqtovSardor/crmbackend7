import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMyProfileDto {
    @ApiPropertyOptional({ description: 'Full name', example: 'Aziza Karimova' })
    @IsString()
    @IsOptional()
    fullName?: string;

    @ApiPropertyOptional({ description: 'Email', example: 'teacher@edu.uz' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ description: 'Profile photo URL', example: 'https://cdn.example.com/avatar.jpg' })
    @IsString()
    @IsOptional()
    photo?: string;

    @ApiPropertyOptional({ description: 'Phone number', example: '+998901234567' })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({ description: 'Birth date (YYYY-MM-DD)', example: '1998-04-12' })
    @IsDateString()
    @IsOptional()
    birthDate?: string;

    @ApiPropertyOptional({ description: 'Position (staff/teacher)', example: 'Frontend Mentor' })
    @IsString()
    @IsOptional()
    position?: string;

    @ApiPropertyOptional({ description: 'Address (staff only)', example: 'Tashkent city' })
    @IsString()
    @IsOptional()
    address?: string;

    @ApiPropertyOptional({ description: 'New password', minLength: 6, example: 'newpass123' })
    @IsString()
    @MinLength(6)
    @IsOptional()
    password?: string;
}
