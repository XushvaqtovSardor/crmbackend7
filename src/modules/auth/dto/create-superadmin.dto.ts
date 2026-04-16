import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateSuperadminDto {
    @ApiProperty({ description: 'Full name', example: 'Azizbek Qodirov' })
    @IsString()
    fullName!: string;

    @ApiPropertyOptional({ description: 'Email address', example: 'superadmin@edu.uz' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ description: 'Phone number', example: '+998901234567' })
    @Matches(/^\+?[1-9]\d{8,14}$/)
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({ description: 'Position', example: 'Superadmin' })
    @IsString()
    @IsOptional()
    position?: string;

    @ApiProperty({ description: 'Password', minLength: 6, example: 'superadmin123' })
    @IsString()
    @MinLength(6)
    password!: string;
}
