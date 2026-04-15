import { BadRequestException, ConflictException, Injectable, UnauthorizedException, } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RegisterStudentDto } from './dto/register-student.dto';
import { RegisterTeacherDto } from './dto/register-teacher.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
const INVALID_CREDENTIALS_MESSAGE = "Email/phone yoki parol noto'g'ri";
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
@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) { }
    async login(dto: LoginDto) {
        const principal = await this.validateAny(dto);
        return this.buildAuthResponse(principal);
    }
    async registerAdmin(dto: RegisterAdminDto) {
        const fullName = String(dto.fullName || '').trim();
        if (!fullName) {
            throw new BadRequestException('fullName is required');
        }
        const contacts = this.normalizeRegistrationContacts(dto.email, dto.phone, 'admin');
        await this.assertUniqueContacts(contacts.email, contacts.phone);
        const passwordHash = await bcrypt.hash(dto.password, 10);
        try {
            const user = await this.prisma.user.create({
                data: {
                    fullName,
                    email: contacts.email,
                    phone: contacts.phone,
                    password: passwordHash,
                    position: dto.position?.trim() || 'Administrator',
                    hire_date: new Date(),
                    role: Role.ADMIN,
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
            return this.buildAuthResponse({
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                address: user.address,
                photo: user.photo,
                status: user.status,
                position: user.position,
                phone: user.phone,
            });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new ConflictException('Account with this email or phone already exists');
            }
            throw error;
        }
    }
    async registerTeacher(dto: RegisterTeacherDto) {
        const fullName = String(dto.fullName || '').trim();
        if (!fullName) {
            throw new BadRequestException('fullName is required');
        }
        const contacts = this.normalizeRegistrationContacts(dto.email, dto.phone, 'teacher');
        await this.assertUniqueContacts(contacts.email, contacts.phone);
        const passwordHash = await bcrypt.hash(dto.password, 10);
        try {
            const teacher = await this.prisma.teacher.create({
                data: {
                    fullName,
                    email: contacts.email,
                    phone: contacts.phone,
                    password: passwordHash,
                    photo: dto.photo?.trim() || null,
                    birth_date: dto.birthDate ? new Date(dto.birthDate) : null,
                    position: dto.position?.trim() || 'Teacher',
                    experience: dto.experience ?? 0,
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
            return this.buildAuthResponse({
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
            });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new ConflictException('Account with this email or phone already exists');
            }
            throw error;
        }
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
        const passwordHash = await bcrypt.hash(dto.password, 10);
        try {
            const student = await this.prisma.student.create({
                data: {
                    fullName,
                    email: contacts.email,
                    phone: contacts.phone,
                    password: passwordHash,
                    photo: dto.photo?.trim() || null,
                    birth_date: new Date(dto.birthDate),
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
            return this.buildAuthResponse({
                id: student.id,
                email: student.email,
                fullName: student.fullName,
                role: Role.STUDENT,
                photo: student.photo,
                phone: student.phone,
                birthDate: student.birth_date,
                status: student.status,
            });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new ConflictException('Account with this email or phone already exists');
            }
            throw error;
        }
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
            }
            else if (payload.role === Role.STUDENT) {
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
            }
            else {
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
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new ConflictException('Account with this email or phone already exists');
            }
            throw error;
        }
        const principal = await this.lookupProfile(payload.role, payload.sub);
        return {
            user: this.toUserPayload(principal),
        };
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
            }
            catch (error) {
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
    private normalizeRegistrationContacts(emailInput: string | undefined, phoneInput: string | undefined, accountKey: 'admin' | 'teacher' | 'student'): {
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
    private buildPhoneEmail(phone: string, accountKey: 'admin' | 'teacher' | 'student'): string {
        const digitsOnly = phone.replace(/\D/g, '');
        if (!digitsOnly) {
            throw new BadRequestException('A valid email or phone is required');
        }
        return `${accountKey}_${digitsOnly}@phone.local`;
    }
    private normalizePhoneValue(phone: string): string {
        return String(phone || '').trim().replace(/[\s()-]/g, '');
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
        const [userByEmail, teacherByEmail, studentByEmail, userByPhone, teacherByPhone, studentByPhone,] = await Promise.all([
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
        if (!authHeader)
            return null;
        const trimmed = authHeader.trim();
        if (!trimmed.toLowerCase().startsWith('bearer '))
            return null;
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
        }
        catch {
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
        return (error instanceof UnauthorizedException &&
            error.message === INVALID_CREDENTIALS_MESSAGE);
    }
    private async verifyPasswordOrThrow(password: string, hash: string) {
        const matched = await bcrypt.compare(password, hash);
        if (!matched) {
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
        }
    }
}
