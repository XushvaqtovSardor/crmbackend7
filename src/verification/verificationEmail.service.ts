import { Injectable } from '@nestjs/common';
import { EmailService } from '../service/email.service';

@Injectable()
export class VerificationEmailService {
    constructor(private readonly emailService: EmailService) { }

    async sendRegisterOtp(email: string, otp: string, ttlSeconds: number): Promise<boolean> {
        const normalizedEmail = String(email || '').trim();
        if (!normalizedEmail) {
            return false;
        }

        return this.emailService.sendOtp(normalizedEmail, otp, ttlSeconds);
    }
}
