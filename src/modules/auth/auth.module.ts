import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpStoreService } from './otp-store.service';

@Module({
    imports: [
        JwtModule.register({
            global: true,
            secret: process.env.JWT_SECRET || 'dev-secret',
            signOptions: {
                algorithm: 'HS256',
                expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as never,
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, OtpStoreService],
    exports: [AuthService],
})
export class AuthModule { }
