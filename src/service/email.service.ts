import { Injectable } from '@nestjs/common';
import { NotificationService } from '../common/notifications';

@Injectable()
export class EmailService {
    constructor(private readonly notificationService: NotificationService) { }

    async sendOtp(email: string, otp: string, ttlSeconds: number): Promise<boolean> {
        return this.notificationService.sendOtpEmail(email, otp, ttlSeconds);
    }
}
