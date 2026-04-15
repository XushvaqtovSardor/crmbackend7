import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
export class RegisterTeacherDto {
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
    @ApiPropertyOptional({ description: 'Profile photo URL', example: 'https://cdn.example.com/teacher.jpg' })
    @IsString()
    @IsOptional()
    photo?: string;
    @ApiPropertyOptional({ description: 'Birth date in ISO format', example: '1998-04-12', format: 'date' })
    @IsDateString()
    @IsOptional()
    birthDate?: string;
    @ApiPropertyOptional({ description: 'Position', example: 'Frontend Mentor' })
    @IsString()
    @IsOptional()
    position?: string;
    @ApiPropertyOptional({ description: 'Years of teaching experience', example: 3 })
    @IsInt()
    @Min(0)
    @IsOptional()
    experience?: number;
    @ApiProperty({ description: 'Password', minLength: 6, example: 'teacher123' })
    @IsString()
    @MinLength(6)
    password!: string;
}
