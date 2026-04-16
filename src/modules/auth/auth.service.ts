import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import { NotificationService } from '../../common/notifications';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpStoreService } from './otp-store.service';
import { CreateSuperadminDto } from './dto/create-superadmin.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RegisterStudentDto } from './dto/register-student.dto';
import { RegisterTeacherDto } from './dto/register-teacher.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto';

const INVALID_CREDENTIALS_MESSAGE = "Email/phone yoki parol noto'g'ri";
const REGISTER_OTP_KEY_PREFIX = 'auth:register:otp';

type JwtPayload = {
    sub: number;
    role: Role;
};

type AuthPrincipal = {
    id: number;
    email: string;
    fullName: string;
    role: Role;
    address?: string | null;
    photo?: string | null;
    status?: UserStatus;
    position?: string | null;
    experience?: number | null;
    phone?: string | null;
    coinBalance?: number | null;
    birthDate?: Date | null;
};

type RegistrationAccountKey = 'admin' | 'teacher' | 'student' | 'superadmin';
type OtpChannel = 'EMAIL' | 'PHONE';

type OtpContact = {
    channel: OtpChannel;
    destination: string;
    email: string;
    phone: string | null;
};

type RegisterOtpRecord = {
    otpHash: string;
    attempts: number;
    channel: OtpChannel;
    destination: string;
    payload: {
        fullName: string;
        email: string;
        phone: string | null;
        password: string;
        photo?: string;
        birthDate: string;
    };
};

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly notificationService: NotificationService,
        private readonly otpStoreService: OtpStoreService,
    ) { }

    async login(dto: LoginDto) {
        const principal = await this.validateAny(dto);
        return this.buildAuthResponse(principal);
    }

    async register(dto: RegisterDto) {
        return this.requestRegisterOtp(dto);
    }

    async requestRegisterOtp(dto: RegisterDto) {
        const fullName = String(dto.fullName || '').trim();

        if (!fullName) {
            throw new BadRequestException('fullName is required');
        }

        const contact = this.resolveOtpContact(dto.email, dto.phone, 'student');

        if (!dto.birthDate) {
            throw new BadRequestException('birthDate is required for student registration');
        }

        await this.assertUniqueContacts(contact.email, contact.phone);

        const verificationId = randomUUID();
        const otp = String(randomInt(100000, 1000000));
        const ttlSeconds = this.getRegisterOtpTtlSeconds();

        const record: RegisterOtpRecord = {
            otpHash: await bcrypt.hash(otp, 8),
            attempts: 0,
            channel: contact.channel,
            destination: contact.destination,
            payload: {
                fullName,
                email: contact.email,
                phone: contact.phone,
                password: dto.password,
                photo: this.trimOptionalString(dto.photo) || undefined,
                birthDate: dto.birthDate,
            },
        };

        await this.otpStoreService.setJson(this.buildRegisterOtpKey(verificationId), record, ttlSeconds);

        if (contact.channel === 'EMAIL') {
            await this.notificationService.sendOtpEmail(contact.destination, otp, ttlSeconds);
        } else {
            await this.notificationService.sendOtpSms(contact.destination, otp, ttlSeconds);
        }

        return {
            verificationId,
            channel: contact.channel,
            destination: this.maskContact(contact.channel, contact.destination),
            expiresIn: ttlSeconds,
            message: "Tasdiqlash kodi yuborildi. Kodni kiritib ro'yxatdan o'tishni yakunlang.",
        };
    }

    async verifyRegisterOtp(dto: VerifyRegisterOtpDto) {
        const verificationId = String(dto.verificationId || '').trim();
        if (!verificationId) {
            throw new BadRequestException('verificationId is required');
        }

        const key = this.buildRegisterOtpKey(verificationId);
        const stored = await this.otpStoreService.getJson<RegisterOtpRecord>(key);

        if (!stored) {
            throw new BadRequestException("OTP topilmadi yoki muddati tugagan. Qayta ro'yxatdan o'ting.");
        }

        const otpMatched = await bcrypt.compare(String(dto.otp || ''), stored.otpHash);
        if (!otpMatched) {
            const maxAttempts = this.getRegisterOtpMaxAttempts();
            const nextAttempts = (stored.attempts || 0) + 1;

            if (nextAttempts >= maxAttempts) {
                await this.otpStoreService.delete(key);
                throw new BadRequestException("OTP urinishlar soni tugadi. Qaytadan ro'yxatdan o'ting.");
            }

            stored.attempts = nextAttempts;
            await this.otpStoreService.setJson(key, stored, this.getRegisterOtpTtlSeconds());

            throw new BadRequestException(`OTP noto'g'ri. Qolgan urinish: ${maxAttempts - nextAttempts}`);
        }

        await this.otpStoreService.delete(key);
        await this.assertUniqueContacts(stored.payload.email, stored.payload.phone);

        await this.createStudentAccountPrincipal({
            fullName: stored.payload.fullName,
            email: stored.payload.email,
            phone: stored.payload.phone,
            photo: stored.payload.photo || null,
            birthDate: stored.payload.birthDate,
            password: stored.payload.password,
        });

        return {
            message: "Ro'yxatdan o'tish tasdiqlandi. Endi login qilib tizimga kiring.",
        };
    }

    async createSuperadmin(authHeader: string, dto: CreateSuperadminDto) {
        const token = this.extractBearerToken(authHeader);
        if (!token) {
            throw new UnauthorizedException('Authorization header with Bearer token is required');
        }

        const actor = this.verifyAccessToken(token);
        if (actor.role !== Role.SUPERADMIN) {
            throw new ForbiddenException('Only SUPERADMIN can create another SUPERADMIN');
        }

        const fullName = String(dto.fullName || '').trim();
        if (!fullName) {
            throw new BadRequestException('fullName is required');
        }

        const contacts = this.normalizeRegistrationContacts(dto.email, dto.phone, 'superadmin');
        await this.assertUniqueContacts(contacts.email, contacts.phone);

        const principal = await this.createPlatformAccountPrincipal({
            fullName,
            email: contacts.email,
            phone: contacts.phone,
            password: dto.password,
            role: Role.SUPERADMIN,
            position: this.trimOptionalString(dto.position) || 'Superadmin',
        });

        return {
            message: 'SUPERADMIN created successfully',
            user: this.toUserPayload(principal),
        };
    }

    async createAdmin(authHeader: string, dto: RegisterAdminDto) {
        const token = this.extractBearerToken(authHeader);
        if (!token) {
            throw new UnauthorizedException('Authorization header with Bearer token is required');
        }

        const actor = this.verifyAccessToken(token);
        if (actor.role !== Role.SUPERADMIN) {
            throw new ForbiddenException('Only SUPERADMIN can create ADMIN');
        }

        const fullName = String(dto.fullName || '').trim();
        if (!fullName) {
            throw new BadRequestException('fullName is required');
        }

        const phone = this.normalizePhoneValue(dto.phone);
        if (!phone) {
            throw new BadRequestException('phone is required for admin creation');
        }

        const contacts = this.normalizeRegistrationContacts(dto.email, phone, 'admin');
        await this.assertUniqueContacts(contacts.email, contacts.phone);

        const principal = await this.createPlatformAccountPrincipal({
            fullName,
            email: contacts.email,
            phone: contacts.phone,
            password: dto.password,
            role: Role.ADMIN,
            position: this.trimOptionalString(dto.position) || 'Administrator',
        });

        await this.notificationService.sendCredentials({
            toEmail: contacts.email,
            toPhone: contacts.phone || undefined,
            fullName,
            login: contacts.phone || contacts.email,
            password: dto.password,
            accountType: 'ADMIN',
        });

        return {
            message: 'ADMIN created successfully',
            user: this.toUserPayload(principal),
        };
    }

    async registerAdmin(dto: RegisterAdminDto) {
        const fullName = String(dto.fullName || '').trim();
        if (!fullName) {
            throw new BadRequestException('fullName is required');
        }

        const contacts = this.normalizeRegistrationContacts(dto.email, dto.phone, 'admin');
        await this.assertUniqueContacts(contacts.email, contacts.phone);

        const principal = await this.createPlatformAccountPrincipal({
            fullName,
            email: contacts.email,
            phone: contacts.phone,
            password: dto.password,
            role: Role.ADMIN,
            position: this.trimOptionalString(dto.position) || 'Administrator',
        });

        return this.buildAuthResponse(principal);
    }

    async registerTeacher(dto: RegisterTeacherDto) {
        const fullName = String(dto.fullName || '').trim();
        if (!fullName) {
            throw new BadRequestException('fullName is required');
        }

        const contacts = this.normalizeRegistrationContacts(dto.email, dto.phone, 'teacher');
        await this.assertUniqueContacts(contacts.email, contacts.phone);

        const principal = await this.createTeacherAccountPrincipal({
            fullName,
            email: contacts.email,
            phone: contacts.phone,
            photo: this.trimOptionalString(dto.photo),
            birthDate: dto.birthDate,
            position: this.trimOptionalString(dto.position),
            experience: dto.experience,
            password: dto.password,
        });

        return this.buildAuthResponse(principal);
    }

    async registerStudent(dto: RegisterStudentDto) {
        const fullName = String(dto.fullName || '').trim();
        if (!fullName) {
            throw new BadRequestException('fullName is required');
        }

        if (!dto.birthDate) {
            throw new BadRequestException('birthDate is required for student registration');
        }

        const contacts = this.normalizeRegistrationContacts(dto.email, dto.phone, 'student');
        await this.assertUniqueContacts(contacts.email, contacts.phone);

        const principal = await this.createStudentAccountPrincipal({
            fullName,
            email: contacts.email,
            phone: contacts.phone,
            photo: this.trimOptionalString(dto.photo),
            birthDate: dto.birthDate,
            password: dto.password,
        });

        return this.buildAuthResponse(principal);
    }

    async loginUser(dto: LoginDto) {
        const principal = await this.validatePlatformUser(dto);
        return this.buildAuthResponse(principal);
    }

    async loginTeacher(dto: LoginDto) {
        const principal = await this.validateTeacher(dto);
        return this.buildAuthResponse(principal);
    }

    async loginStudent(dto: LoginDto) {
        const principal = await this.validateStudent(dto);
        return this.buildAuthResponse(principal);
    }

    async profile(authHeader: string) {
        const token = this.extractBearerToken(authHeader);
        if (!token) {
            throw new UnauthorizedException('Authorization header with Bearer token is required');
        }

        const payload = this.verifyAccessToken(token);
        const principal = await this.lookupProfile(payload.role, payload.sub);

        return {
            user: this.toUserPayload(principal),
        };
    }

    async updateProfile(authHeader: string, dto: UpdateMyProfileDto) {
        const token = this.extractBearerToken(authHeader);
        if (!token) {
            throw new UnauthorizedException('Authorization header with Bearer token is required');
        }

        const payload = this.verifyAccessToken(token);

        try {
            if (payload.role === Role.TEACHER) {
                const updateData: Prisma.TeacherUpdateInput = {};

                if (typeof dto.fullName === 'string') {
                    const fullName = dto.fullName.trim();
                    if (fullName) {
                        updateData.fullName = fullName;
                    }
                }

                if (typeof dto.email === 'string') {
                    const email = dto.email.trim().toLowerCase();
                    if (email) {
                        updateData.email = email;
                    }
                }

                if (typeof dto.photo === 'string') {
                    updateData.photo = dto.photo.trim() || null;
                }

                if (typeof dto.phone === 'string') {
                    updateData.phone = dto.phone.trim() || null;
                }

                if (typeof dto.position === 'string') {
                    const position = dto.position.trim();
                    if (position) {
                        updateData.position = position;
                    }
                }

                if (typeof dto.birthDate === 'string') {
                    const parsed = new Date(dto.birthDate);
                    if (Number.isNaN(parsed.getTime())) {
                        throw new BadRequestException('Invalid birthDate value');
                    }
                    updateData.birth_date = parsed;
                }

                if (typeof dto.password === 'string') {
                    const password = dto.password.trim();
                    if (password) {
                        updateData.password = await bcrypt.hash(password, 10);
                    }
                }

                if (Object.keys(updateData).length > 0) {
                    await this.prisma.teacher.update({
                        where: { id: payload.sub },
                        data: updateData,
                    });
                }
            } else if (payload.role === Role.STUDENT) {
                const updateData: Prisma.StudentUpdateInput = {};

                if (typeof dto.fullName === 'string') {
                    const fullName = dto.fullName.trim();
                    if (fullName) {
                        updateData.fullName = fullName;
                    }
                }

                if (typeof dto.email === 'string') {
                    const email = dto.email.trim().toLowerCase();
                    if (email) {
                        updateData.email = email;
                    }
                }

                if (typeof dto.photo === 'string') {
                    updateData.photo = dto.photo.trim() || null;
                }

                if (typeof dto.phone === 'string') {
                    updateData.phone = this.normalizePhoneValue(dto.phone) || null;
                }

                if (typeof dto.birthDate === 'string') {
                    const parsed = new Date(dto.birthDate);
                    if (Number.isNaN(parsed.getTime())) {
                        throw new BadRequestException('Invalid birthDate value');
                    }
                    updateData.birth_date = parsed;
                }

                if (typeof dto.password === 'string') {
                    const password = dto.password.trim();
                    if (password) {
                        updateData.password = await bcrypt.hash(password, 10);
                    }
                }

                if (Object.keys(updateData).length > 0) {
                    await this.prisma.student.update({
                        where: { id: payload.sub },
                        data: updateData,
                    });
                }
            } else {
                const updateData: Prisma.UserUpdateInput = {};

                if (typeof dto.fullName === 'string') {
                    const fullName = dto.fullName.trim();
                    if (fullName) {
                        updateData.fullName = fullName;
                    }
                }

                if (typeof dto.email === 'string') {
                    const email = dto.email.trim().toLowerCase();
                    if (email) {
                        updateData.email = email;
                    }
                }

                if (typeof dto.photo === 'string') {
                    updateData.photo = dto.photo.trim() || null;
                }

                if (typeof dto.phone === 'string') {
                    updateData.phone = this.normalizePhoneValue(dto.phone) || null;
                }

                if (typeof dto.position === 'string') {
                    const position = dto.position.trim();
                    if (position) {
                        updateData.position = position;
                    }
                }

                if (typeof dto.address === 'string') {
                    updateData.address = dto.address.trim() || null;
                }

                if (typeof dto.password === 'string') {
                    const password = dto.password.trim();
                    if (password) {
                        updateData.password = await bcrypt.hash(password, 10);
                    }
                }

                if (Object.keys(updateData).length > 0) {
                    await this.prisma.user.update({
                        where: { id: payload.sub },
                        data: updateData,
                    });
                }
            }
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException('Account with this email or phone already exists');
            }

            throw error;
        }

        const principal = await this.lookupProfile(payload.role, payload.sub);

        return {
            user: this.toUserPayload(principal),
        };
    }

    private async createPlatformAccountPrincipal(input: {
        fullName: string;
        email: string;
        phone: string | null;
        password: string;
        role: Role;
        position: string;
    }): Promise<AuthPrincipal> {
        const passwordHash = await bcrypt.hash(input.password, 10);

        try {
            const user = await this.prisma.user.create({
                data: {
                    fullName: input.fullName,
                    email: input.email,
                    phone: input.phone,
                    password: passwordHash,
                    position: input.position,
                    hire_date: new Date(),
                    role: input.role,
                    status: UserStatus.ACTIVE,
                },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    role: true,
                    address: true,
                    photo: true,
                    status: true,
                    position: true,
                    phone: true,
                },
            });

            return {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                address: user.address,
                photo: user.photo,
                status: user.status,
                position: user.position,
                phone: user.phone,
            };
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException('Account with this email or phone already exists');
            }

            throw error;
        }
    }

    private async createTeacherAccountPrincipal(input: {
        fullName: string;
        email: string;
        phone: string | null;
        photo?: string | null;
        birthDate?: string;
        position?: string | null;
        experience?: number;
        password: string;
    }): Promise<AuthPrincipal> {
        const birthDate = this.parseDateOrNull(input.birthDate);
        const passwordHash = await bcrypt.hash(input.password, 10);

        try {
            const teacher = await this.prisma.teacher.create({
                data: {
                    fullName: input.fullName,
                    email: input.email,
                    phone: input.phone,
                    password: passwordHash,
                    photo: input.photo ?? null,
                    birth_date: birthDate,
                    position: this.trimOptionalString(input.position) || 'Teacher',
                    experience: input.experience ?? 0,
                    status: UserStatus.ACTIVE,
                },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    photo: true,
                    position: true,
                    experience: true,
                    phone: true,
                    coinBalance: true,
                    birth_date: true,
                    status: true,
                },
            });

            return {
                id: teacher.id,
                email: teacher.email,
                fullName: teacher.fullName,
                role: Role.TEACHER,
                photo: teacher.photo,
                position: teacher.position,
                experience: teacher.experience,
                phone: teacher.phone,
                coinBalance: teacher.coinBalance,
                birthDate: teacher.birth_date,
                status: teacher.status,
            };
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException('Account with this email or phone already exists');
            }

            throw error;
        }
    }

    private async createStudentAccountPrincipal(input: {
        fullName: string;
        email: string;
        phone: string | null;
        photo?: string | null;
        birthDate: string;
        password: string;
    }): Promise<AuthPrincipal> {
        const birthDate = this.parseDateRequired(
            input.birthDate,
            'birthDate is required for student registration',
        );
        const passwordHash = await bcrypt.hash(input.password, 10);

        try {
            const student = await this.prisma.student.create({
                data: {
                    fullName: input.fullName,
                    email: input.email,
                    phone: input.phone,
                    password: passwordHash,
                    photo: input.photo ?? null,
                    birth_date: birthDate,
                    status: UserStatus.ACTIVE,
                },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    photo: true,
                    phone: true,
                    birth_date: true,
                    status: true,
                },
            });

            return {
                id: student.id,
                email: student.email,
                fullName: student.fullName,
                role: Role.STUDENT,
                photo: student.photo,
                phone: student.phone,
                birthDate: student.birth_date,
                status: student.status,
            };
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException('Account with this email or phone already exists');
            }

            throw error;
        }
    }

    private async buildAuthResponse(principal: AuthPrincipal) {
        const payload = {
            sub: principal.id,
            email: principal.email,
            fullName: principal.fullName,
            role: principal.role,
        };

        const accessToken = await this.jwtService.signAsync(payload);

        return {
            accessToken,
            tokenType: 'Bearer',
            user: this.toUserPayload(principal),
        };
    }

    private async validateAny(dto: LoginDto): Promise<AuthPrincipal> {
        const validators = [
            this.validatePlatformUser.bind(this),
            this.validateTeacher.bind(this),
            this.validateStudent.bind(this),
        ];

        for (const validate of validators) {
            try {
                return await validate(dto);
            } catch (error) {
                if (!this.isInvalidCredentialsError(error)) {
                    throw error;
                }
            }
        }

        throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    private async validatePlatformUser(dto: LoginDto): Promise<AuthPrincipal> {
        const identifier = this.parseLoginIdentifier(dto.email);

        const platformUser = await this.prisma.user.findFirst({
            where: identifier.email
                ? { email: identifier.email }
                : { phone: identifier.phone },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                password: true,
                address: true,
                photo: true,
                status: true,
                position: true,
                phone: true,
            },
        });

        if (!platformUser) {
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
        }

        await this.verifyPasswordOrThrow(dto.password, platformUser.password);

        return {
            id: platformUser.id,
            email: platformUser.email,
            fullName: platformUser.fullName,
            role: platformUser.role,
            address: platformUser.address,
            photo: platformUser.photo,
            status: platformUser.status,
            position: platformUser.position,
            phone: platformUser.phone,
        };
    }

    private async validateTeacher(dto: LoginDto): Promise<AuthPrincipal> {
        const identifier = this.parseLoginIdentifier(dto.email);

        const teacher = await this.prisma.teacher.findFirst({
            where: identifier.email
                ? { email: identifier.email }
                : { phone: identifier.phone },
            select: {
                id: true,
                fullName: true,
                email: true,
                password: true,
                photo: true,
                position: true,
                experience: true,
                phone: true,
                birth_date: true,
                coinBalance: true,
                status: true,
            },
        });

        if (!teacher) {
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
        }

        await this.verifyPasswordOrThrow(dto.password, teacher.password);

        return {
            id: teacher.id,
            email: teacher.email,
            fullName: teacher.fullName,
            role: Role.TEACHER,
            photo: teacher.photo,
            position: teacher.position,
            experience: teacher.experience,
            phone: teacher.phone,
            coinBalance: teacher.coinBalance,
            birthDate: teacher.birth_date,
            status: teacher.status,
        };
    }

    private async validateStudent(dto: LoginDto): Promise<AuthPrincipal> {
        const identifier = this.parseLoginIdentifier(dto.email);

        const student = await this.prisma.student.findFirst({
            where: identifier.email
                ? { email: identifier.email }
                : { phone: identifier.phone },
            select: {
                id: true,
                fullName: true,
                email: true,
                password: true,
                photo: true,
                phone: true,
                birth_date: true,
                status: true,
            },
        });

        if (!student) {
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
        }

        await this.verifyPasswordOrThrow(dto.password, student.password);

        return {
            id: student.id,
            email: student.email,
            fullName: student.fullName,
            role: Role.STUDENT,
            photo: student.photo,
            phone: student.phone,
            birthDate: student.birth_date,
            status: student.status,
        };
    }

    private resolveOtpContact(
        emailInput: string | undefined,
        phoneInput: string | undefined,
        accountKey: RegistrationAccountKey,
    ): OtpContact {
        const email = typeof emailInput === 'string'
            ? emailInput.trim().toLowerCase()
            : '';
        const phone = typeof phoneInput === 'string'
            ? this.normalizePhoneValue(phoneInput)
            : '';

        const hasEmail = Boolean(email);
        const hasPhone = Boolean(phone);

        if (!hasEmail && !hasPhone) {
            throw new BadRequestException('Email yoki telefonning bittasi kiritilishi shart');
        }

        if (hasEmail && hasPhone) {
            throw new BadRequestException('Faqat email yoki telefondan bittasini tanlang');
        }

        if (hasEmail) {
            return {
                channel: 'EMAIL',
                destination: email,
                email,
                phone: null,
            };
        }

        return {
            channel: 'PHONE',
            destination: phone,
            email: this.buildPhoneEmail(phone, accountKey),
            phone,
        };
    }

    private normalizeRegistrationContacts(
        emailInput: string | undefined,
        phoneInput: string | undefined,
        accountKey: RegistrationAccountKey,
    ): {
        email: string;
        phone: string | null;
    } {
        const email = typeof emailInput === 'string'
            ? emailInput.trim().toLowerCase()
            : '';
        const phone = typeof phoneInput === 'string'
            ? this.normalizePhoneValue(phoneInput)
            : '';

        if (!email && !phone) {
            throw new BadRequestException('Either email or phone is required');
        }

        return {
            email: email || this.buildPhoneEmail(phone, accountKey),
            phone: phone || null,
        };
    }

    private buildPhoneEmail(phone: string, accountKey: RegistrationAccountKey): string {
        const digitsOnly = phone.replace(/\D/g, '');
        if (!digitsOnly) {
            throw new BadRequestException('A valid email or phone is required');
        }

        return `${accountKey}_${digitsOnly}@phone.local`;
    }

    private normalizePhoneValue(phone: string): string {
        return String(phone || '').trim().replace(/[\s()-]/g, '');
    }

    private parseDateOrNull(value?: string): Date | null {
        if (!value) {
            return null;
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            throw new BadRequestException('Invalid birthDate value');
        }

        return parsed;
    }

    private parseDateRequired(value: string, missingMessage: string): Date {
        if (!value) {
            throw new BadRequestException(missingMessage);
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            throw new BadRequestException('Invalid birthDate value');
        }

        return parsed;
    }

    private parseLoginIdentifier(identifier: string): {
        email: string | null;
        phone: string | null;
    } {
        const value = String(identifier || '').trim();
        if (!value) {
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
        }

        if (value.includes('@')) {
            return {
                email: value.toLowerCase(),
                phone: null,
            };
        }

        const normalizedPhone = this.normalizePhoneValue(value);
        if (!normalizedPhone) {
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
        }

        return {
            email: null,
            phone: normalizedPhone,
        };
    }

    private async assertUniqueContacts(email: string, phone: string | null) {
        const [
            userByEmail,
            teacherByEmail,
            studentByEmail,
            userByPhone,
            teacherByPhone,
            studentByPhone,
        ] = await Promise.all([
            this.prisma.user.findFirst({ where: { email }, select: { id: true } }),
            this.prisma.teacher.findFirst({ where: { email }, select: { id: true } }),
            this.prisma.student.findFirst({ where: { email }, select: { id: true } }),
            phone
                ? this.prisma.user.findFirst({ where: { phone }, select: { id: true } })
                : Promise.resolve(null),
            phone
                ? this.prisma.teacher.findFirst({ where: { phone }, select: { id: true } })
                : Promise.resolve(null),
            phone
                ? this.prisma.student.findFirst({ where: { phone }, select: { id: true } })
                : Promise.resolve(null),
        ]);

        if (userByEmail || teacherByEmail || studentByEmail) {
            throw new ConflictException('Account with this email already exists');
        }

        if (userByPhone || teacherByPhone || studentByPhone) {
            throw new ConflictException('Account with this phone already exists');
        }
    }

    private extractBearerToken(authHeader: string): string | null {
        if (!authHeader) {
            return null;
        }

        const trimmed = authHeader.trim();
        if (!trimmed.toLowerCase().startsWith('bearer ')) {
            return null;
        }

        return trimmed.slice(7).trim() || null;
    }

    private verifyAccessToken(token: string): JwtPayload {
        try {
            const payload = this.jwtService.verify<JwtPayload>(token, {
                algorithms: ['HS256'],
                secret: process.env.JWT_SECRET || 'dev-secret',
            });

            if (!Number.isInteger(payload.sub) || !Object.values(Role).includes(payload.role)) {
                throw new UnauthorizedException('Invalid token payload');
            }

            return payload;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    private async lookupProfile(role: Role, id: number): Promise<AuthPrincipal> {
        switch (role) {
            case Role.TEACHER: {
                const teacher = await this.prisma.teacher.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        photo: true,
                        position: true,
                        experience: true,
                        phone: true,
                        birth_date: true,
                        coinBalance: true,
                        status: true,
                    },
                });

                if (!teacher) {
                    throw new UnauthorizedException('Teacher account not found');
                }

                return {
                    id: teacher.id,
                    email: teacher.email,
                    fullName: teacher.fullName,
                    role: Role.TEACHER,
                    photo: teacher.photo,
                    position: teacher.position,
                    experience: teacher.experience,
                    phone: teacher.phone,
                    coinBalance: teacher.coinBalance,
                    birthDate: teacher.birth_date,
                    status: teacher.status,
                };
            }

            case Role.STUDENT: {
                const student = await this.prisma.student.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        photo: true,
                        phone: true,
                        birth_date: true,
                        status: true,
                    },
                });

                if (!student) {
                    throw new UnauthorizedException('Student account not found');
                }

                return {
                    id: student.id,
                    email: student.email,
                    fullName: student.fullName,
                    role: Role.STUDENT,
                    photo: student.photo,
                    phone: student.phone,
                    birthDate: student.birth_date,
                    status: student.status,
                };
            }

            default: {
                const user = await this.prisma.user.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                        address: true,
                        photo: true,
                        position: true,
                        phone: true,
                        status: true,
                    },
                });

                if (!user) {
                    throw new UnauthorizedException('User account not found');
                }

                return {
                    id: user.id,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                    address: user.address,
                    photo: user.photo,
                    position: user.position,
                    phone: user.phone,
                    status: user.status,
                };
            }
        }
    }

    private toUserPayload(principal: AuthPrincipal) {
        return {
            id: principal.id,
            fullName: principal.fullName,
            email: principal.email,
            role: principal.role,
            address: principal.address ?? null,
            photo: principal.photo ?? null,
            status: principal.status ?? null,
            position: principal.position ?? null,
            experience: principal.experience ?? null,
            phone: principal.phone ?? null,
            coinBalance: principal.coinBalance ?? null,
            birthDate: principal.birthDate ?? null,
        };
    }

    private isInvalidCredentialsError(error: unknown): boolean {
        return (
            error instanceof UnauthorizedException &&
            error.message === INVALID_CREDENTIALS_MESSAGE
        );
    }

    private async verifyPasswordOrThrow(password: string, hash: string) {
        const matched = await bcrypt.compare(password, hash);
        if (!matched) {
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
        }
    }

    private buildRegisterOtpKey(verificationId: string): string {
        return `${REGISTER_OTP_KEY_PREFIX}:${verificationId}`;
    }

    private getRegisterOtpTtlSeconds(): number {
        const value = Number(process.env.REGISTER_OTP_TTL_SECONDS ?? 300);
        if (!Number.isFinite(value) || value < 60) {
            return 300;
        }

        return Math.floor(value);
    }

    private getRegisterOtpMaxAttempts(): number {
        const value = Number(process.env.REGISTER_OTP_MAX_ATTEMPTS ?? 5);
        if (!Number.isFinite(value) || value < 1) {
            return 5;
        }

        return Math.floor(value);
    }

    private trimOptionalString(value: string | undefined | null): string | null {
        if (typeof value !== 'string') {
            return null;
        }

        const trimmed = value.trim();
        return trimmed || null;
    }

    private maskContact(channel: OtpChannel, destination: string): string {
        if (channel === 'EMAIL') {
            const [local = '', domain = ''] = destination.split('@');
            if (!local || !domain) {
                return destination;
            }

            const maskedLocal = local.length <= 2
                ? `${local[0] || '*'}*`
                : `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`;

            return `${maskedLocal}@${domain}`;
        }

        const digits = destination.replace(/\D/g, '');
        if (digits.length < 4) {
            return destination;
        }

        const masked = `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
        return destination.startsWith('+') ? `+${masked}` : masked;
    }
}
