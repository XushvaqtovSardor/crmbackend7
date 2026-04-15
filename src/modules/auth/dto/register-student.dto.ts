import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
export class RegisterStudentDto {
    @ApiProperty({ description: 'Full name', example: 'Sardor Xushvaqtov' })
    @IsString()
    fullName!: string;
    @ApiPropertyOptional({ description: 'Email address', example: 'student@edu.uz' })
    @IsEmail()
    @IsOptional()
    email?: string;
    @ApiPropertyOptional({ description: 'Phone number', example: '+998901234567' })
    @Matches(/^\+?[1-9]\d{8,14}$/)
    @IsOptional()
    phone?: string;
    @ApiPropertyOptional({ description: 'Profile photo URL', example: 'https://cdn.example.com/student.jpg' })
    @IsString()
    @IsOptional()
    photo?: string;
    @ApiProperty({ description: 'Birth date in ISO format', example: '2006-05-12', format: 'date' })
    @IsDateString()
    birthDate!: string;
    @ApiProperty({ description: 'Password', minLength: 6, example: 'student123' })
    @IsString()
    @MinLength(6)
    password!: string;
}
