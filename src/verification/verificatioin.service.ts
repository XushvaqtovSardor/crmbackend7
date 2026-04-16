import { Injectable } from '@nestjs/common';
import { SmsService } from '../service/sms.service';

@Injectable()
export class VerificationPhoneService {
    constructor(private readonly smsService: SmsService) { }

    async sendRegisterOtp(phone: string, otp: string, ttlSeconds: number): Promise<boolean> {
        const normalizedPhone = String(phone || '').trim();
        if (!normalizedPhone) {
            return false;
        }

        return this.smsService.sendOtp(normalizedPhone, otp, ttlSeconds);
    }
}
