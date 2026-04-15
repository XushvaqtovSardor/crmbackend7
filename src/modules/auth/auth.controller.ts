import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RegisterStudentDto } from './dto/register-student.dto';
import { RegisterTeacherDto } from './dto/register-teacher.dto';
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

    @Post('register/admin')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register admin/staff account (email or phone)' })
    @ApiBody({ type: RegisterAdminDto })
    @ApiResponse({ status: 201, description: 'Admin account created and JWT generated' })
    @ApiResponse({ status: 400, description: 'Invalid registration payload' })
    @ApiResponse({ status: 409, description: 'Email or phone already exists' })
    registerAdmin(@Body() dto: RegisterAdminDto) {
        return this.authService.registerAdmin(dto);
    }

    @Post('register/teacher')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register teacher account (email or phone)' })
    @ApiBody({ type: RegisterTeacherDto })
    @ApiResponse({ status: 201, description: 'Teacher account created and JWT generated' })
    @ApiResponse({ status: 400, description: 'Invalid registration payload' })
    @ApiResponse({ status: 409, description: 'Email or phone already exists' })
    registerTeacher(@Body() dto: RegisterTeacherDto) {
        return this.authService.registerTeacher(dto);
    }

    @Post('register/student')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register student account (email or phone)' })
    @ApiBody({ type: RegisterStudentDto })
    @ApiResponse({ status: 201, description: 'Student account created and JWT generated' })
    @ApiResponse({ status: 400, description: 'Invalid registration payload' })
    @ApiResponse({ status: 409, description: 'Email or phone already exists' })
    registerStudent(@Body() dto: RegisterStudentDto) {
        return this.authService.registerStudent(dto);
    }

    @Post('login/user')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login as platform user (admin/superadmin/staff)' })
    @ApiBody({ type: LoginDto })
    @ApiResponse({ status: 200, description: 'JWT generated successfully' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    loginUser(@Body() dto: LoginDto) {
        return this.authService.loginUser(dto);
    }

    @Post('login/teacher')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login as teacher' })
    @ApiBody({ type: LoginDto })
    @ApiResponse({ status: 200, description: 'JWT generated successfully' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    loginTeacher(@Body() dto: LoginDto) {
        return this.authService.loginTeacher(dto);
    }

    @Post('login/student')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login as student' })
    @ApiBody({ type: LoginDto })
    @ApiResponse({ status: 200, description: 'JWT generated successfully' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    loginStudent(@Body() dto: LoginDto) {
        return this.authService.loginStudent(dto);
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
