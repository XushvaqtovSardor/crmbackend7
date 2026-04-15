import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

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
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register account by role (ADMIN/TEACHER/STUDENT) using email or phone' })
    @ApiBody({ type: RegisterDto })
    @ApiResponse({ status: 201, description: 'Account created and JWT generated' })
    @ApiResponse({ status: 400, description: 'Invalid registration payload' })
    @ApiResponse({ status: 409, description: 'Email or phone already exists' })
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
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
