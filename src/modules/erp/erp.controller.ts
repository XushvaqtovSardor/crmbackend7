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
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiParam,
    ApiResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AssignHomeworkDto } from './dto/assign-homework.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { PublishVideoDto } from './dto/publish-video.dto';
import { ReviewHomeworkDto } from './dto/review-homework.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';
import { UpdateHomeworkPolicyDto } from './dto/update-homework-policy.dto';
import { ErpService } from './erp.service';

const VIDEO_UPLOAD_DIR = join(process.cwd(), 'uploads', 'lesson-videos');
const VIDEO_UPLOAD_MAX_SIZE =
    Number.parseInt(process.env.VIDEO_UPLOAD_MAX_SIZE || '', 10) ||
    250 * 1024 * 1024;
const IMAGE_UPLOAD_DIR = join(process.cwd(), 'uploads', 'profile-images');
const IMAGE_UPLOAD_MAX_SIZE =
    Number.parseInt(process.env.IMAGE_UPLOAD_MAX_SIZE || '', 10) ||
    5 * 1024 * 1024;

function ensureVideoUploadDir() {
    mkdirSync(VIDEO_UPLOAD_DIR, { recursive: true });
}

function ensureImageUploadDir() {
    mkdirSync(IMAGE_UPLOAD_DIR, { recursive: true });
}

function resolveVideoExtension(originalName: string) {
    const extension = extname(String(originalName || '')).toLowerCase();
    if (extension && /^[a-z0-9.]+$/.test(extension)) {
        return extension;
    }
    return '.mp4';
}

function isSupportedVideoFile(file: { mimetype?: string; originalname?: string }) {
    const mimeType = String(file.mimetype || '').toLowerCase();
    if (mimeType.startsWith('video/')) {
        return true;
    }

    const extension = resolveVideoExtension(file.originalname || '');
    return ['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv', '.ogg'].includes(
        extension,
    );
}

function buildVideoFileName(originalName: string) {
    const extension = resolveVideoExtension(originalName);
    const random = Math.random().toString(36).slice(2, 10);
    return `${Date.now()}-${random}${extension}`;
}

function resolveImageExtension(originalName: string, mimeType?: string) {
    const extension = extname(String(originalName || '')).toLowerCase();
    if (extension && /^[a-z0-9.]+$/.test(extension)) {
        return extension;
    }

    const normalizedMime = String(mimeType || '').toLowerCase();
    if (normalizedMime === 'image/png') return '.png';
    if (normalizedMime === 'image/webp') return '.webp';
    if (normalizedMime === 'image/gif') return '.gif';
    if (normalizedMime === 'image/svg+xml') return '.svg';

    return '.jpg';
}

function isSupportedImageFile(file: { mimetype?: string; originalname?: string }) {
    const mimeType = String(file.mimetype || '').toLowerCase();
    if (!mimeType.startsWith('image/')) {
        return false;
    }

    const extension = resolveImageExtension(file.originalname || '', mimeType);
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'].includes(
        extension,
    );
}

function buildImageFileName(originalName: string, mimeType?: string) {
    const extension = resolveImageExtension(originalName, mimeType);
    const random = Math.random().toString(36).slice(2, 10);
    return `${Date.now()}-${random}${extension}`;
}

function buildPublicFileUrl(req: Request, relativeUrl: string) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = String(
        Array.isArray(forwardedProto)
            ? forwardedProto[0]
            : forwardedProto || req.protocol || 'http',
    )
        .split(',')[0]
        .trim();
    const host = req.get('host');

    return host ? `${protocol}://${host}${relativeUrl}` : relativeUrl;
}

@Controller('erp')
@UseGuards(RolesGuard)
@ApiTags('erp')
@ApiBearerAuth('access-token')
@ApiSecurity('x-user-id')
@ApiSecurity('x-user-role')
@ApiHeader({
    name: 'x-user-id',
    required: false,
    description: 'Optional for backward compatibility; auto-populated from Bearer token by RolesGuard',
})
@ApiHeader({
    name: 'x-user-role',
    required: false,
    description: 'Optional for backward compatibility; auto-populated from Bearer token by RolesGuard',
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

    @Post('teacher/videos/upload')
    @Roles(Role.TEACHER)
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: (_req, _file, callback) => {
                    ensureVideoUploadDir();
                    callback(null, VIDEO_UPLOAD_DIR);
                },
                filename: (_req, file, callback) => {
                    callback(null, buildVideoFileName(file.originalname));
                },
            }),
            limits: {
                fileSize: VIDEO_UPLOAD_MAX_SIZE,
            },
            fileFilter: (_req, file, callback) => {
                if (!isSupportedVideoFile(file)) {
                    callback(
                        new BadRequestException(
                            'Faqat video fayllar qabul qilinadi',
                        ),
                        false,
                    );
                    return;
                }

                callback(null, true);
            },
        }),
    )
    @ApiOperation({
        summary: 'Teacher uploads raw video file and receives public URL',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
            required: ['file'],
        },
    })
    @ApiResponse({ status: 201, description: 'Video uploaded' })
    uploadLessonVideo(
        @Headers('x-user-id') teacherId: string,
        @UploadedFile() file: Express.Multer.File,
        @Req() req: Request,
    ) {
        this.parseUserId(teacherId);

        if (!file) {
            throw new BadRequestException('Video fayli topilmadi');
        }

        const relativeUrl = `/uploads/lesson-videos/${file.filename}`;

        return {
            fileName: file.originalname,
            relativeUrl,
            url: buildPublicFileUrl(req, relativeUrl),
            mimeType: file.mimetype,
            size: file.size,
        };
    }

    @Post('media/images/upload')
    @Roles(
        Role.SUPERADMIN,
        Role.ADMIN,
        Role.MANAGEMENT,
        Role.ADMINSTRATOR,
        Role.TEACHER,
        Role.STUDENT,
    )
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: (_req, _file, callback) => {
                    ensureImageUploadDir();
                    callback(null, IMAGE_UPLOAD_DIR);
                },
                filename: (_req, file, callback) => {
                    callback(
                        null,
                        buildImageFileName(file.originalname, file.mimetype),
                    );
                },
            }),
            limits: {
                fileSize: IMAGE_UPLOAD_MAX_SIZE,
            },
            fileFilter: (_req, file, callback) => {
                if (!isSupportedImageFile(file)) {
                    callback(
                        new BadRequestException(
                            'Faqat rasm fayllar qabul qilinadi',
                        ),
                        false,
                    );
                    return;
                }

                callback(null, true);
            },
        }),
    )
    @ApiOperation({
        summary: 'Upload profile image and receive public URL',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
            required: ['file'],
        },
    })
    @ApiResponse({ status: 201, description: 'Image uploaded' })
    uploadProfileImage(
        @UploadedFile() file: Express.Multer.File,
        @Req() req: Request,
    ) {
        if (!file) {
            throw new BadRequestException('Rasm fayli topilmadi');
        }

        const relativeUrl = `/uploads/profile-images/${file.filename}`;

        return {
            fileName: file.originalname,
            relativeUrl,
            url: buildPublicFileUrl(req, relativeUrl),
            mimeType: file.mimetype,
            size: file.size,
        };
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

    @Get('student/videos')
    @Roles(Role.STUDENT)
    @ApiOperation({ summary: 'Student lesson videos from joined groups' })
    @ApiResponse({ status: 200, description: 'Student videos returned' })
    getStudentVideos(@Headers('x-user-id') studentId: string) {
        return this.erpService.getStudentVideos(this.parseUserId(studentId));
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
