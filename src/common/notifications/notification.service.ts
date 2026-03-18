import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

type CredentialsPayload = {
    toEmail: string;
    toPhone?: string;
    fullName: string;
    login: string;
    password: string;
    accountType: 'TEACHER' | 'STUDENT';
};

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    async sendCredentials(payload: CredentialsPayload): Promise<void> {
        await Promise.all([
            this.sendCredentialsEmail(payload),
            this.sendCredentialsSms(payload),
        ]);
    }

    private async sendCredentialsEmail(payload: CredentialsPayload): Promise<void> {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || '587');
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.SMTP_FROM || user;

        if (!host || !user || !pass || !from) {
            this.logger.warn(
                `SMTP is not configured. Credentials email was skipped for ${payload.toEmail}`,
            );
            return;
        }

        try {
            const transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });

            const subject = `${payload.accountType} account credentials`;
            const text = [
                `Salom, ${payload.fullName}!`,
                '',
                `${payload.accountType} akkauntingiz yaratildi.`,
                `Login: ${payload.login}`,
                `Password: ${payload.password}`,
                '',
                'Parolni birinchi kirishda almashtiring.',
            ].join('\n');

            await transporter.sendMail({
                from,
                to: payload.toEmail,
                subject,
                text,
            });
        } catch (error) {
            this.logger.error(
                `Failed to send credentials email to ${payload.toEmail}`,
                error as Error,
            );
        }
    }

    private async sendCredentialsSms(payload: CredentialsPayload): Promise<void> {
        const toPhone = payload.toPhone;
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromPhone = process.env.TWILIO_FROM_PHONE;

        if (!toPhone) {
            return;
        }

        if (!accountSid || !authToken || !fromPhone) {
            this.logger.warn(
                `Twilio is not configured. Credentials SMS was skipped for ${toPhone}`,
            );
            return;
        }

        try {
            const client = twilio(accountSid, authToken);
            await client.messages.create({
                from: fromPhone,
                to: toPhone,
                body: `EduERP ${payload.accountType} login: ${payload.login}, password: ${payload.password}`,
            });
        } catch (error) {
            this.logger.error(
                `Failed to send credentials SMS to ${toPhone}`,
                error as Error,
            );
        }
    }
}
