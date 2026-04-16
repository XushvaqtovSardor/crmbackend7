import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class VerifyRegisterOtpDto {
    @ApiProperty({
        description: 'Verification id returned by register request',
        example: '8af2f57f-2f03-4cae-9fca-d26c4a5f6e0e',
    })
    @IsString()
    @MinLength(8)
    verificationId!: string;

    @ApiProperty({
        description: 'One-time password sent via SMS or email',
        example: '684213',
    })
    @IsString()
    @Matches(/^\d{6}$/)
    otp!: string;
}
