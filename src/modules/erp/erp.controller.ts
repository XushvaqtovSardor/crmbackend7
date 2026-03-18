import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AssignHomeworkDto } from './dto/assign-homework.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { PublishVideoDto } from './dto/publish-video.dto';
import { ReviewHomeworkDto } from './dto/review-homework.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';
import { UpdateHomeworkPolicyDto } from './dto/update-homework-policy.dto';
import { ErpService } from './erp.service';

@Controller('erp')
@UseGuards(RolesGuard)
@ApiTags('erp')
@ApiSecurity('x-user-id')
@ApiSecurity('x-user-role')
@ApiHeader({
    name: 'x-user-id',
    required: true,
    description: 'Authenticated user id used by ERP endpoints',
})
@ApiHeader({
    name: 'x-user-role',
    required: true,
    description: 'Authenticated role. Examples: TEACHER, STUDENT, SUPERADMIN',
})
export class ErpController {
    constructor(private readonly erpService: ErpService) { }

    @Post('teacher/lessons')
    @Roles(Role.TEACHER)
    @ApiOperation({ summary: 'Teacher creates lesson' })
    @ApiBody({ type: CreateLessonDto })
    @ApiResponse({ status: 201, description: 'Lesson created' })
    @ApiResponse({ status: 403, description: 'Not allowed for this teacher' })
    createLesson(
        @Headers('x-user-id') teacherId: string,
        @Body() dto: CreateLessonDto,
    ) {
        return this.erpService.createLesson(this.parseUserId(teacherId), dto);
    }

    @Post('teacher/videos')
    @Roles(Role.TEACHER)
    @ApiOperation({ summary: 'Teacher uploads lesson video' })
    @ApiBody({ type: PublishVideoDto })
    @ApiResponse({ status: 201, description: 'Video published' })
    @ApiResponse({ status: 404, description: 'Lesson not found' })
    publishVideo(
        @Headers('x-user-id') teacherId: string,
        @Body() dto: PublishVideoDto,
    ) {
        return this.erpService.publishVideo(this.parseUserId(teacherId), dto);
    }

    @Post('teacher/homeworks')
    @Roles(Role.TEACHER)
    @ApiOperation({ summary: 'Teacher assigns homework' })
    @ApiBody({ type: AssignHomeworkDto })
    @ApiResponse({ status: 201, description: 'Homework assigned' })
    @ApiResponse({ status: 400, description: 'Validation error' })
    assignHomework(
        @Headers('x-user-id') teacherId: string,
        @Body() dto: AssignHomeworkDto,
    ) {
        return this.erpService.assignHomework(this.parseUserId(teacherId), dto);
    }

    @Patch('teacher/homeworks/:homeworkId/policy')
    @Roles(Role.TEACHER)
    @ApiOperation({ summary: 'Teacher updates homework policy' })
    @ApiParam({ name: 'homeworkId', type: Number, example: 1 })
    @ApiBody({ type: UpdateHomeworkPolicyDto })
    @ApiResponse({ status: 200, description: 'Homework policy updated' })
    @ApiResponse({ status: 404, description: 'Homework not found' })
    updateHomeworkPolicy(
        @Headers('x-user-id') teacherId: string,
        @Param('homeworkId', ParseIntPipe) homeworkId: number,
        @Body() dto: UpdateHomeworkPolicyDto,
    ) {
        return this.erpService.updateHomeworkPolicy(
            this.parseUserId(teacherId),
            homeworkId,
            dto,
        );
    }

    @Get('teacher/homeworks/:homeworkId/submissions')
    @Roles(Role.TEACHER)
    @ApiOperation({ summary: 'Teacher gets homework submissions' })
    @ApiParam({ name: 'homeworkId', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Submission list returned' })
    getHomeworkSubmissions(
        @Headers('x-user-id') teacherId: string,
        @Param('homeworkId', ParseIntPipe) homeworkId: number,
    ) {
        return this.erpService.getHomeworkSubmissions(
            this.parseUserId(teacherId),
            homeworkId,
        );
    }

    @Post('teacher/homeworks/review')
    @Roles(Role.TEACHER)
    @ApiOperation({ summary: 'Teacher reviews homework result' })
    @ApiBody({ type: ReviewHomeworkDto })
    @ApiResponse({ status: 201, description: 'Homework reviewed' })
    @ApiResponse({ status: 404, description: 'Submission not found' })
    reviewHomework(
        @Headers('x-user-id') teacherId: string,
        @Body() dto: ReviewHomeworkDto,
    ) {
        return this.erpService.reviewHomework(this.parseUserId(teacherId), dto);
    }

    @Get('teacher/dashboard')
    @Roles(Role.TEACHER)
    @ApiOperation({ summary: 'Teacher dashboard metrics' })
    @ApiResponse({ status: 200, description: 'Teacher dashboard returned' })
    getTeacherDashboard(@Headers('x-user-id') teacherId: string) {
        return this.erpService.getTeacherDashboard(this.parseUserId(teacherId));
    }

    @Post('student/submissions')
    @Roles(Role.STUDENT)
    @ApiOperation({ summary: 'Student submits homework' })
    @ApiBody({ type: SubmitHomeworkDto })
    @ApiResponse({ status: 201, description: 'Homework submitted' })
    @ApiResponse({ status: 409, description: 'Attempt limit reached' })
    submitHomework(
        @Headers('x-user-id') studentId: string,
        @Body() dto: SubmitHomeworkDto,
    ) {
        return this.erpService.submitHomework(this.parseUserId(studentId), dto);
    }

    @Get('student/dashboard')
    @Roles(Role.STUDENT)
    @ApiOperation({ summary: 'Student dashboard data' })
    @ApiResponse({ status: 200, description: 'Student dashboard returned' })
    getStudentDashboard(@Headers('x-user-id') studentId: string) {
        return this.erpService.getStudentDashboard(this.parseUserId(studentId));
    }

    @Get('student/progress')
    @Roles(Role.STUDENT)
    @ApiOperation({ summary: 'Student progress statistics' })
    @ApiResponse({ status: 200, description: 'Student progress returned' })
    getStudentProgress(@Headers('x-user-id') studentId: string) {
        return this.erpService.getStudentProgress(this.parseUserId(studentId));
    }

    @Get('finance/report')
    @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'Finance report for superadmin' })
    @ApiResponse({ status: 200, description: 'Finance report returned' })
    getFinanceReport() {
        return this.erpService.getFinanceReport();
    }

    @Get('superadmin/analytics')
    @Roles(Role.SUPERADMIN)
    @ApiOperation({ summary: 'Global analytics for superadmin' })
    @ApiResponse({ status: 200, description: 'Analytics returned' })
    getSuperAdminAnalytics() {
        return this.erpService.getSuperAdminAnalytics();
    }

    private parseUserId(rawId: string): number {
        const parsed = Number(rawId);
        if (!Number.isInteger(parsed) || parsed < 1) {
            throw new BadRequestException(
                'x-user-id header must be a positive integer',
            );
        }

        return parsed;
    }
}
