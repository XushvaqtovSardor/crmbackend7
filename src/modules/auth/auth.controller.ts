import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateSuperadminDto } from './dto/create-superadmin.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Universal login (auto-detect user type)' })
    @ApiBody({ type: LoginDto })
    @ApiResponse({ status: 200, description: 'JWT generated successfully' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('register')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Start public registration (STUDENT only) and send OTP to email or phone' })
    @ApiBody({ type: RegisterDto })
    @ApiResponse({ status: 200, description: 'OTP sent for registration verification' })
    @ApiResponse({ status: 400, description: 'Invalid payload or both contact channels were provided' })
    @ApiResponse({ status: 409, description: 'Email or phone already exists' })
    register(@Body() dto: RegisterDto) {
        return this.authService.requestRegisterOtp(dto);
    }

    @Post('register/verify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify OTP and complete public registration' })
    @ApiBody({ type: VerifyRegisterOtpDto })
    @ApiResponse({ status: 200, description: 'Registration completed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
    verifyRegisterOtp(@Body() dto: VerifyRegisterOtpDto) {
        return this.authService.verifyRegisterOtp(dto);
    }

    @Post('admins')
    @HttpCode(HttpStatus.CREATED)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Create a new ADMIN (only authenticated SUPERADMIN can do this)' })
    @ApiBody({ type: RegisterAdminDto })
    @ApiResponse({ status: 201, description: 'Admin created' })
    @ApiResponse({ status: 403, description: 'Only superadmin can create admin' })
    createAdmin(
        @Headers('authorization') authHeader: string,
        @Body() dto: RegisterAdminDto,
    ) {
        return this.authService.createAdmin(authHeader, dto);
    }

    @Post('superadmins')
    @HttpCode(HttpStatus.CREATED)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Create a new SUPERADMIN (only authenticated SUPERADMIN can do this)' })
    @ApiBody({ type: CreateSuperadminDto })
    @ApiResponse({ status: 201, description: 'Superadmin created' })
    @ApiResponse({ status: 403, description: 'Only superadmin can create superadmin' })
    createSuperadmin(
        @Headers('authorization') authHeader: string,
        @Body() dto: CreateSuperadminDto,
    ) {
        return this.authService.createSuperadmin(authHeader, dto);
    }

    @Get('me')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Resolve profile from Bearer token (any role)' })
    @ApiResponse({ status: 200, description: 'Profile resolved from token' })
    @ApiResponse({ status: 401, description: 'Invalid or missing token' })
    getProfile(@Headers('authorization') authHeader: string) {
        return this.authService.profile(authHeader);
    }

    @Patch('me')
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Update authenticated profile by role' })
    @ApiBody({ type: UpdateMyProfileDto })
    @ApiResponse({ status: 200, description: 'Profile updated' })
    @ApiResponse({ status: 401, description: 'Invalid or missing token' })
    updateProfile(
        @Headers('authorization') authHeader: string,
        @Body() dto: UpdateMyProfileDto,
    ) {
        return this.authService.updateProfile(authHeader, dto);
    }
}
