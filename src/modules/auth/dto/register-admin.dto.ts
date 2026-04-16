import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

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

    @ApiProperty({ description: 'Password', minLength: 6, example: 'admin123' })
    @IsString()
    @MinLength(6)
    password!: string;
}
