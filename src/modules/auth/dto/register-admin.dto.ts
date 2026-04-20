import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterAdminDto {
    @ApiProperty({ description: 'Full name', example: 'Dilshod Raximov' })
    @IsString()
    fullName!: string;

    @ApiPropertyOptional({ description: 'Email address', example: 'admin@edu.uz' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty({ description: 'Phone number (required for SMS credentials)', example: '+998901234567' })
    @Matches(/^\+?[1-9]\d{8,14}$/)
    phone!: string;

    @ApiPropertyOptional({ description: 'Position', example: 'Administrator' })
    @IsString()
    @IsOptional()
    position?: string;

    @ApiPropertyOptional({
        description: 'Staff role (defaults to ADMIN)',
        enum: [Role.ADMIN, Role.MANAGEMENT, Role.ADMINSTRATOR],
        example: Role.ADMIN,
    })
    @IsEnum(Role)
    @IsOptional()
    role?: Role;

    @ApiProperty({ description: 'Password', minLength: 6, example: 'admin123' })
    @IsString()
    @MinLength(6)
    password!: string;
}
