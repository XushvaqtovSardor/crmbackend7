import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';
import { ROLES } from 'src/common/auth/roles.decorator';

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
}
