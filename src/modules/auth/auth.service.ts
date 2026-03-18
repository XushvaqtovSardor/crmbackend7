import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

type AuthPrincipal = {
    id: number;
    email: string;
    fullName: string;
    role: Role;
};

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    async login(dto: LoginDto) {
        const principal = await this.validateAny(dto);

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
            user: {
                id: principal.id,
                fullName: principal.fullName,
                email: principal.email,
                role: principal.role,
            },
        };
    }

    private async validateAny(dto: LoginDto): Promise<AuthPrincipal> {
        try {
            return await this.validatePlatformUser(dto);
        } catch {
            // Continue trying other account types.
        }

        try {
            return await this.validateTeacher(dto);
        } catch {
            // Continue trying student account type.
        }

        return this.validateStudent(dto);
    }

    private async validatePlatformUser(dto: LoginDto): Promise<AuthPrincipal> {
        const platformUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                password: true,
            },
        });

        if (!platformUser) {
            throw new UnauthorizedException('Email or password is incorrect');
        }

        const matched = await bcrypt.compare(dto.password, platformUser.password);
        if (!matched) {
            throw new UnauthorizedException('Email or password is incorrect');
        }

        return {
            id: platformUser.id,
            email: platformUser.email,
            fullName: platformUser.fullName,
            role: platformUser.role,
        };
    }

    private async validateTeacher(dto: LoginDto): Promise<AuthPrincipal> {
        const teacher = await this.prisma.teacher.findUnique({
            where: { email: dto.email },
            select: {
                id: true,
                fullName: true,
                email: true,
                password: true,
            },
        });

        if (!teacher) {
            throw new UnauthorizedException('Email or password is incorrect');
        }

        const matched = await bcrypt.compare(dto.password, teacher.password);
        if (!matched) {
            throw new UnauthorizedException('Email or password is incorrect');
        }

        return {
            id: teacher.id,
            email: teacher.email,
            fullName: teacher.fullName,
            role: Role.TEACHER,
        };
    }

    private async validateStudent(dto: LoginDto): Promise<AuthPrincipal> {
        const student = await this.prisma.student.findUnique({
            where: { email: dto.email },
            select: {
                id: true,
                fullName: true,
                email: true,
                password: true,
            },
        });

        if (!student) {
            throw new UnauthorizedException('Email or password is incorrect');
        }

        const matched = await bcrypt.compare(dto.password, student.password);
        if (!matched) {
            throw new UnauthorizedException('Email or password is incorrect');
        }

        return {
            id: student.id,
            email: student.email,
            fullName: student.fullName,
            role: Role.STUDENT,
        };
    }
}
