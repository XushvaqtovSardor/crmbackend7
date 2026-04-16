import { Injectable } from '@nestjs/common';
import { NotificationService } from '../common/notifications';

@Injectable()
export class SmsService {
    constructor(private readonly notificationService: NotificationService) { }

    async sendOtp(phone: string, otp: string, ttlSeconds: number): Promise<boolean> {
        return this.notificationService.sendOtpSms(phone, otp, ttlSeconds);
    }
}
