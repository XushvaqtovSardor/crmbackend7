import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Min, MinLength, ValidateIf } from 'class-validator';

const REGISTER_ROLES = ['ADMIN', 'TEACHER', 'STUDENT'] as const;

export class RegisterDto {
    @ApiProperty({
        description: 'Account role to create',
        enum: REGISTER_ROLES,
        example: 'STUDENT',
    })
    @IsIn(REGISTER_ROLES)
    role!: 'ADMIN' | 'TEACHER' | 'STUDENT';

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

    @ApiPropertyOptional({ description: 'Position (admin/teacher)', example: 'Frontend Mentor' })
    @IsString()
    @IsOptional()
    position?: string;

    @ApiPropertyOptional({ description: 'Profile photo URL', example: 'https://cdn.example.com/profile.jpg' })
    @IsString()
    @IsOptional()
    photo?: string;

    @ApiPropertyOptional({ description: 'Birth date in ISO format', example: '2006-05-12', format: 'date' })
    @ValidateIf((o: RegisterDto) => o.role === 'STUDENT' || typeof o.birthDate === 'string')
    @IsDateString()
    birthDate?: string;

    @ApiPropertyOptional({ description: 'Years of experience (teacher)', example: 3 })
    @ValidateIf((o: RegisterDto) => o.role === 'TEACHER' || typeof o.experience === 'number')
    @IsInt()
    @Min(0)
    experience?: number;
}
