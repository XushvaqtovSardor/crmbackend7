import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

const ESKIZ_AUTH_URL = 'https://notify.eskiz.uz/api/auth/login';
const ESKIZ_SEND_SMS_URL = 'https://notify.eskiz.uz/api/message/sms/send';
const ESKIZ_TOKEN_TTL_MS = 55 * 60 * 1000;
const OTP_SMS_TEMPLATE_DEFAULT = "Fixoo platformasidan ro'yxatdan o'tish uchun tasdiqlash kodi: {{OTP}}. Kodni hech kimga bermang!";

type CredentialsPayload = {
    toEmail: string;
    toPhone?: string;
    fullName: string;
    login: string;
    password: string;
    accountType: 'TEACHER' | 'STUDENT' | 'ADMIN' | 'MANAGEMENT' | 'ADMINSTRATOR';
};

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private eskizToken: string | null = null;
    private eskizTokenExpiresAt = 0;

    async sendOtpEmail(toEmail: string, otp: string, ttlSeconds: number): Promise<boolean> {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || '587');
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = this.resolveSmtpFrom(user);

        if (!host || !user || !pass || !from) {
            this.logger.warn(`SMTP is not configured. OTP email was skipped for ${toEmail}`);
            return false;
        }

        try {
            const transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });

            const text = [
                'EduERP tasdiqlash kodi',
                '',
                `Bir martalik kod: ${otp}`,
                `Kod ${ttlSeconds} soniya davomida amal qiladi.`,
                '',
                'Agar bu harakat sizga tegishli bo\'lmasa, xabarni e\'tiborsiz qoldiring.',
            ].join('\n');

            await transporter.sendMail({
                from,
                to: toEmail,
                subject: 'EduERP tasdiqlash kodi',
                text,
            });

            return true;
        } catch (error) {
            this.logger.error(`Failed to send OTP email to ${toEmail}`, error as Error);
            return false;
        }
    }

    async sendOtpSms(toPhone: string, otp: string, ttlSeconds: number): Promise<boolean> {
        const sent = await this.sendSms(toPhone, this.buildOtpSmsText(otp, ttlSeconds));

        if (!sent) {
            if (!this.isSmsProviderConfigured()) {
                this.logger.warn(
                    `SMS provider is not configured (Twilio/Eskiz). OTP SMS was skipped for ${toPhone}`,
                );
            } else {
                this.logger.error(
                    `OTP SMS send failed for ${toPhone}. Check provider credentials and Eskiz approved template text.`,
                );
            }
        }

        return sent;
    }

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
        const from = this.resolveSmtpFrom(user);

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

        if (!toPhone) {
            return;
        }

        const sent = await this.sendSms(
            toPhone,
            `EduERP ${payload.accountType} login: ${payload.login}, password: ${payload.password}`,
        );

        if (!sent) {
            if (!this.isSmsProviderConfigured()) {
                this.logger.warn(
                    `SMS provider is not configured (Twilio/Eskiz). Credentials SMS was skipped for ${toPhone}`,
                );
            } else {
                this.logger.error(
                    `Credentials SMS send failed for ${toPhone}. Check provider credentials and Eskiz approved template text.`,
                );
            }
        }
    }

    private async sendSms(toPhone: string, message: string): Promise<boolean> {
        const normalizedPhone = this.normalizePhone(toPhone);
        if (!normalizedPhone) {
            return false;
        }

        if (await this.sendSmsViaTwilio(normalizedPhone, message)) {
            return true;
        }

        return this.sendSmsViaEskiz(normalizedPhone, message);
    }

    private async sendSmsViaTwilio(toPhone: string, message: string): Promise<boolean> {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromPhone = process.env.TWILIO_FROM_PHONE;

        if (!accountSid || !authToken || !fromPhone) {
            return false;
        }

        try {
            const client = twilio(accountSid, authToken);
            await client.messages.create({
                from: fromPhone,
                to: toPhone,
                body: message,
            });

            return true;
        } catch (error) {
            this.logger.error(`Failed to send SMS via Twilio to ${toPhone}`, error as Error);
            return false;
        }
    }

    private async sendSmsViaEskiz(toPhone: string, message: string): Promise<boolean> {
        const email = process.env.ESKIZ_EMAIL || process.env.SMS_API_KEY;
        const password = process.env.ESKIZ_PASSWORD || process.env.SMS_API_SECRET;
        const from = process.env.ESKIZ_FROM || process.env.SMS_FROM;

        if (!email || !password || !from) {
            return false;
        }

        let token = await this.getEskizToken(email, password);
        if (!token) {
            return false;
        }

        let response = await this.sendEskizSmsRequest(token, toPhone, from, message);

        if (response.status === 401) {
            this.clearEskizToken();
            token = await this.getEskizToken(email, password, true);

            if (!token) {
                return false;
            }

            response = await this.sendEskizSmsRequest(token, toPhone, from, message);
        }

        if (!response.ok) {
            const responseBody = await this.safeReadResponse(response);
            this.logger.error(
                `Eskiz SMS send failed for ${toPhone} (${response.status}): ${responseBody}`,
            );
            return false;
        }

        return true;
    }

    private async getEskizToken(
        email: string,
        password: string,
        forceRefresh = false,
    ): Promise<string | null> {
        if (
            !forceRefresh &&
            this.eskizToken &&
            this.eskizTokenExpiresAt > Date.now()
        ) {
            return this.eskizToken;
        }

        try {
            const response = await fetch(ESKIZ_AUTH_URL, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const responseBody = await this.safeReadResponse(response);
                this.logger.error(
                    `Eskiz auth failed (${response.status}): ${responseBody}`,
                );
                return null;
            }

            const payload = (await response.json()) as {
                data?: {
                    token?: string;
                };
            };

            const token = payload?.data?.token;
            if (!token) {
                this.logger.error('Eskiz auth response does not contain token');
                return null;
            }

            this.eskizToken = token;
            this.eskizTokenExpiresAt = Date.now() + ESKIZ_TOKEN_TTL_MS;

            return token;
        } catch (error) {
            this.logger.error('Failed to authenticate with Eskiz SMS API', error as Error);
            return null;
        }
    }

    private async sendEskizSmsRequest(
        token: string,
        toPhone: string,
        from: string,
        message: string,
    ): Promise<Response> {
        const body = new URLSearchParams({
            mobile_phone: toPhone.replace(/^\+/, ''),
            message,
            from,
        });

        return fetch(ESKIZ_SEND_SMS_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });
    }

    private normalizePhone(phone: string): string {
        const value = String(phone || '').trim();

        if (!value) {
            return '';
        }

        if (value.startsWith('+')) {
            const digits = value.slice(1).replace(/\D/g, '');
            return digits ? `+${digits}` : '';
        }

        return value.replace(/\D/g, '');
    }

    private buildOtpSmsText(otp: string, ttlSeconds: number): string {
        const template = OTP_SMS_TEMPLATE_DEFAULT;

        return template
            .replace(/\{\{\s*OTP\s*\}\}/g, otp)
            .replace(/\{\{\s*TTL\s*\}\}/g, String(ttlSeconds));
    }

    private resolveSmtpFrom(user?: string): string {
        const from = String(process.env.SMTP_FROM || '').trim();
        if (from.includes('@')) {
            return from;
        }

        return String(user || '').trim();
    }

    private isSmsProviderConfigured(): boolean {
        const hasTwilio = Boolean(
            process.env.TWILIO_ACCOUNT_SID
            && process.env.TWILIO_AUTH_TOKEN
            && process.env.TWILIO_FROM_PHONE,
        );

        const hasEskiz = Boolean(
            (process.env.ESKIZ_EMAIL || process.env.SMS_API_KEY)
            && (process.env.ESKIZ_PASSWORD || process.env.SMS_API_SECRET)
            && (process.env.ESKIZ_FROM || process.env.SMS_FROM),
        );

        return hasTwilio || hasEskiz;
    }

    private clearEskizToken(): void {
        this.eskizToken = null;
        this.eskizTokenExpiresAt = 0;
    }

    private async safeReadResponse(response: Response): Promise<string> {
        try {
            return await response.text();
        } catch {
            return 'No response body';
        }
    }
}
