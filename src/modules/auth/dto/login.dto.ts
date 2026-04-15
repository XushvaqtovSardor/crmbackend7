import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        description: 'Email or phone for login',
        example: 'teacher@edu.uz',
    })
    @IsString()
    email!: string;

    @ApiProperty({
        description: 'User password',
        minLength: 6,
        example: 'teacher123',
    })
    @IsString()
    @MinLength(6)
    password!: string;
}
export class LoginAdminDto {
    @ApiProperty({
        description: 'Email or phone for login',
        example: 'superadmin@gmail.com',
    })
    @IsString()
    email!: string;

    @ApiProperty({
        description: 'User password',
        minLength: 6,
        example: 'pass1',
    })
    @IsString()
    @MinLength(6)
    password!: string;
}

