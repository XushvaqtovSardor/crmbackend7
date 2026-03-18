import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        description: 'User email for login',
        example: 'teacher@edu.uz',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'User password',
        minLength: 6,
        example: 'teacher123',
    })
    @IsString()
    @MinLength(6)
    password: string;
}
export class LoginAdminDto {
    @ApiProperty({
        description: 'User email for login',
        example: 'superadmin@gmail.com',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'User password',
        minLength: 6,
        example: 'pass1',
    })
    @IsString()
    @MinLength(6)
    password: string;
}

