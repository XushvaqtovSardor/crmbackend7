import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, } from '@nestjs/common';
import { HomeworkStatus, HomeworkStatusStudent, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignHomeworkDto } from './dto/assign-homework.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { PublishVideoDto } from './dto/publish-video.dto';
import { ReviewHomeworkDto } from './dto/review-homework.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';
import { UpdateHomeworkPolicyDto } from './dto/update-homework-policy.dto';
@Injectable()
export class ErpService {
    constructor(private readonly prisma: PrismaService) { }
    async createLesson(teacherId: number, dto: CreateLessonDto) {
        await this.ensureTeacherCanManageGroup(teacherId, dto.groupId);
        return this.prisma.lesson.create({
            data: {
                groupId: dto.groupId,
                title: dto.title,
                teacherId,
            },
            include: {
                group: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
    }
    async publishVideo(teacherId: number, dto: PublishVideoDto) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: dto.lessonId },
            select: {
                id: true,
                teacherId: true,
            },
        });
        if (!lesson) {
            throw new NotFoundException(`Lesson with ID ${dto.lessonId} not found`);
        }
        if (lesson.teacherId !== teacherId) {
            throw new ForbiddenException('You can only upload videos for your own lessons');
        }
        return this.prisma.lessonVideo.create({
            data: {
                lessonId: dto.lessonId,
                teacherId,
                file: dto.file,
            },
        });
    }
    async assignHomework(teacherId: number, dto: AssignHomeworkDto) {
        await this.ensureTeacherOwnsLesson(teacherId, dto.lessonId);
        const deadlineAt = new Date(dto.deadlineAt);
        if (Number.isNaN(deadlineAt.getTime())) {
            throw new BadRequestException('Invalid deadlineAt date');
        }
        return this.prisma.homework.create({
            data: {
                lessonId: dto.lessonId,
                teacherId,
                title: dto.title,
                file: dto.file,
                durationTime: dto.durationTime,
                deadlineAt,
                maxAttempts: dto.maxAttempts || 1,
                allowLateSubmission: dto.allowLateSubmission || false,
            },
        });
    }
    async updateHomeworkPolicy(teacherId: number, homeworkId: number, dto: UpdateHomeworkPolicyDto) {
        await this.ensureTeacherOwnsHomework(teacherId, homeworkId);
        const updateData: Prisma.HomeworkUpdateInput = {};
        if (dto.deadlineAt) {
            const deadlineAt = new Date(dto.deadlineAt);
            if (Number.isNaN(deadlineAt.getTime())) {
                throw new BadRequestException('Invalid deadlineAt date');
            }
            updateData.deadlineAt = deadlineAt;
        }
        if (dto.maxAttempts) {
            const maxAttemptsUsed = await this.prisma.homeworkResponse.aggregate({
                where: { homeworkId },
                _max: { attemptNo: true },
            });
            if ((maxAttemptsUsed._max.attemptNo || 0) > dto.maxAttempts) {
                throw new BadRequestException('maxAttempts cannot be less than already used attempts');
            }
            updateData.maxAttempts = dto.maxAttempts;
        }
        if (typeof dto.allowLateSubmission === 'boolean') {
            updateData.allowLateSubmission = dto.allowLateSubmission;
        }
        return this.prisma.homework.update({
            where: { id: homeworkId },
            data: updateData,
        });
    }
    async submitHomework(studentId: number, dto: SubmitHomeworkDto) {
        const homework = await this.prisma.homework.findUnique({
            where: { id: dto.homeworkId },
            include: {
                lesson: {
                    select: {
                        groupId: true,
                    },
                },
            },
        });
        if (!homework) {
            throw new NotFoundException(`Homework with ID ${dto.homeworkId} not found`);
        }
        const isMember = await this.prisma.studentGroup.findFirst({
            where: {
                groupId: homework.lesson.groupId,
                studentId,
            },
            select: { id: true },
        });
        if (!isMember) {
            throw new ForbiddenException('Student is not a member of this lesson group');
        }
        const attemptsUsed = await this.prisma.homeworkResponse.count({
            where: {
                homeworkId: dto.homeworkId,
                studentId,
            },
        });
        if (attemptsUsed >= homework.maxAttempts) {
            throw new ConflictException('Submission attempt limit reached for this homework');
        }
        const now = new Date();
        const isLate = homework.deadlineAt ? now > homework.deadlineAt : false;
        if (isLate && !homework.allowLateSubmission) {
            throw new ForbiddenException('Deadline has passed and late submission is disabled');
        }
        return this.prisma.homeworkResponse.create({
            data: {
                homeworkId: dto.homeworkId,
                studentId,
                title: dto.title,
                file: dto.file,
                attemptNo: attemptsUsed + 1,
                status: isLate
                    ? HomeworkStatusStudent.DELAY
                    : HomeworkStatusStudent.COMPLETED,
            },
        });
    }
    async getHomeworkSubmissions(teacherId: number, homeworkId: number) {
        await this.ensureTeacherOwnsHomework(teacherId, homeworkId);
        const [responses, results] = await Promise.all([
            this.prisma.homeworkResponse.findMany({
                where: { homeworkId },
                orderBy: [{ studentId: 'asc' }, { attemptNo: 'desc' }],
                include: {
                    student: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                        },
                    },
                },
            }),
            this.prisma.homeworkResult.findMany({
                where: { homeworkId },
                orderBy: { updated_at: 'desc' },
                select: {
                    studentId: true,
                    score: true,
                    status: true,
                    updated_at: true,
                },
            }),
        ]);
        const gradeByStudent = new Map<number, (typeof results)[number]>();
        for (const grade of results) {
            if (!gradeByStudent.has(grade.studentId)) {
                gradeByStudent.set(grade.studentId, grade);
            }
        }
        return responses.map((response) => ({
            ...response,
            latestGrade: gradeByStudent.get(response.studentId) || null,
        }));
    }
    async reviewHomework(teacherId: number, dto: ReviewHomeworkDto) {
        await this.ensureTeacherOwnsHomework(teacherId, dto.homeworkId);
        const latestResponse = await this.prisma.homeworkResponse.findFirst({
            where: {
                homeworkId: dto.homeworkId,
                studentId: dto.studentId,
            },
            orderBy: {
                attemptNo: 'desc',
            },
        });
        if (!latestResponse) {
            throw new NotFoundException('No submission found to review for this student');
        }
        const existingResult = await this.prisma.homeworkResult.findFirst({
            where: {
                homeworkId: dto.homeworkId,
                studentId: dto.studentId,
            },
            orderBy: {
                updated_at: 'desc',
            },
        });
        const resultPayload = {
            homeworkId: dto.homeworkId,
            studentId: dto.studentId,
            teacherId,
            title: latestResponse.title,
            file: latestResponse.file,
            score: dto.score,
            status: dto.status,
        };
        const [gradedResult, reviewedResponse] = await this.prisma.$transaction([
            existingResult
                ? this.prisma.homeworkResult.update({
                    where: { id: existingResult.id },
                    data: resultPayload,
                })
                : this.prisma.homeworkResult.create({ data: resultPayload }),
            this.prisma.homeworkResponse.update({
                where: { id: latestResponse.id },
                data: {
                    feedback: dto.feedback,
                    reviewedAt: new Date(),
                },
            }),
        ]);
        return {
            gradedResult,
            reviewedResponse,
        };
    }
    async getTeacherDashboard(teacherId: number) {
        const [groupCount, lessonCount, homeworkCount, upcomingDeadlines, recentHomeworks, pendingReviews] = await Promise.all([
            this.prisma.group.count({ where: { teacherId } }),
            this.prisma.lesson.count({ where: { teacherId } }),
            this.prisma.homework.count({ where: { teacherId } }),
            this.prisma.homework.findMany({
                where: {
                    teacherId,
                    deadlineAt: {
                        gte: new Date(),
                    },
                },
                orderBy: { deadlineAt: 'asc' },
                take: 6,
                select: {
                    id: true,
                    title: true,
                    deadlineAt: true,
                    maxAttempts: true,
                    allowLateSubmission: true,
                    lesson: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                },
            }),
            this.prisma.homework.findMany({
                where: { teacherId },
                orderBy: { created_at: 'desc' },
                take: 10,
                select: {
                    id: true,
                    title: true,
                    deadlineAt: true,
                    maxAttempts: true,
                    allowLateSubmission: true,
                    created_at: true,
                    lesson: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                },
            }),
            this.prisma.homeworkResponse.count({
                where: {
                    homework: {
                        teacherId,
                    },
                    reviewedAt: null,
                },
            }),
        ]);
        return {
            groupCount,
            lessonCount,
            homeworkCount,
            pendingReviews,
            upcomingDeadlines,
            recentHomeworks,
            groups: groupCount,
            lessons: lessonCount,
            homeworks: homeworkCount,
            submissionsToReview: pendingReviews,
        };
    }
    async getStudentDashboard(studentId: number) {
        await this.ensureStudentExists(studentId);
        const groupIds = await this.getStudentGroupIds(studentId);
        const assigned = await this.prisma.homework.findMany({
            where: {
                lesson: {
                    groupId: {
                        in: groupIds.length ? groupIds : [-1],
                    },
                },
            },
            orderBy: { created_at: 'desc' },
            take: 20,
            select: {
                id: true,
                title: true,
                deadlineAt: true,
                maxAttempts: true,
                allowLateSubmission: true,
                created_at: true,
                lesson: {
                    select: {
                        id: true,
                        title: true,
                        group: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        const submissions = await this.prisma.homeworkResponse.findMany({
            where: { studentId },
            select: {
                homeworkId: true,
                status: true,
                attemptNo: true,
            },
        });
        const submissionMap = new Map<number, {
            status: HomeworkStatusStudent;
            attemptNo: number;
        }>();
        for (const item of submissions) {
            const current = submissionMap.get(item.homeworkId);
            if (!current || item.attemptNo > current.attemptNo) {
                submissionMap.set(item.homeworkId, {
                    status: item.status,
                    attemptNo: item.attemptNo,
                });
            }
        }
        const homeworks = assigned.map((homework) => {
            const latestSubmission = submissionMap.get(homework.id);
            const submitted = Boolean(latestSubmission);
            return {
                ...homework,
                submitted,
                submitStatus: latestSubmission?.status || 'NOT_SUBMITTED',
                attemptNo: latestSubmission?.attemptNo || 0,
            };
        });
        const now = new Date();
        const submittedCount = homeworks.filter((item) => item.submitted).length;
        const overdueCount = homeworks.filter((item) => item.deadlineAt && new Date(item.deadlineAt) < now && !item.submitted).length;
        const videos = await this.getStudentVideos(studentId, 12);
        return {
            homeworks,
            videos,
            homeworkCount: homeworks.length,
            submittedCount,
            pendingCount: Math.max(homeworks.length - submittedCount, 0),
            overdueCount,
        };
    }
    async getStudentProgress(studentId: number) {
        await this.ensureStudentExists(studentId);
        const [responses, grades] = await Promise.all([
            this.prisma.homeworkResponse.findMany({
                where: { studentId },
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    title: true,
                    created_at: true,
                    feedback: true,
                    reviewedAt: true,
                    attemptNo: true,
                    status: true,
                    homeworkId: true,
                    homework: {
                        select: {
                            title: true,
                        },
                    },
                },
            }),
            this.prisma.homeworkResult.findMany({
                where: { studentId },
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    title: true,
                    homeworkId: true,
                    score: true,
                    status: true,
                    created_at: true,
                    updated_at: true,
                },
            }),
        ]);
        const latestGradeByHomework = new Map<number, {
            score: number;
            status: HomeworkStatus;
            created_at: Date;
            updated_at: Date;
        }>();
        for (const grade of grades) {
            if (!latestGradeByHomework.has(grade.homeworkId)) {
                latestGradeByHomework.set(grade.homeworkId, {
                    score: grade.score,
                    status: grade.status,
                    created_at: grade.created_at,
                    updated_at: grade.updated_at,
                });
            }
        }
        const submissions = responses.map((response) => {
            const grade = latestGradeByHomework.get(response.homeworkId);
            return {
                id: response.id,
                homeworkId: response.homeworkId,
                title: response.title || response.homework?.title || `Homework #${response.homeworkId}`,
                status: response.status,
                attemptNo: response.attemptNo,
                feedback: response.feedback || null,
                reviewedAt: response.reviewedAt || null,
                created_at: response.created_at,
                score: grade?.score || 0,
            };
        });
        const gradeRows = grades.map((grade) => ({
            id: grade.id,
            homeworkId: grade.homeworkId,
            title: grade.title || `Homework #${grade.homeworkId}`,
            score: grade.score,
            status: grade.status,
            created_at: grade.created_at,
            updated_at: grade.updated_at,
        }));
        const approved = grades.filter((g) => g.status === HomeworkStatus.APPROVED).length;
        const rejected = grades.filter((g) => g.status === HomeworkStatus.REJECTED).length;
        const pending = grades.filter((g) => g.status === HomeworkStatus.PENDING).length;
        const averageScore = grades.length
            ? Number((grades.reduce((sum, item) => sum + item.score, 0) / grades.length).toFixed(2))
            : 0;
        const onTime = responses.filter((r) => r.status === HomeworkStatusStudent.COMPLETED).length;
        const late = responses.filter((r) => r.status === HomeworkStatusStudent.DELAY).length;
        return {
            submissions,
            grades: gradeRows,
            averageScore,
            submissionCount: responses.length,
            onTime,
            late,
            grading: {
                approved,
                rejected,
                pending,
                averageScore,
            },
        };
    }
    async getStudentVideos(studentId: number, take = 40) {
        await this.ensureStudentExists(studentId);
        const groupIds = await this.getStudentGroupIds(studentId);
        const videos = await this.prisma.lessonVideo.findMany({
            where: {
                lesson: {
                    groupId: {
                        in: groupIds.length ? groupIds : [-1],
                    },
                },
            },
            orderBy: { created_at: 'desc' },
            take,
            select: {
                id: true,
                file: true,
                created_at: true,
                lesson: {
                    select: {
                        id: true,
                        title: true,
                        group: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                teacher: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
            },
        });
        return videos.map((video) => ({
            id: video.id,
            file: video.file,
            created_at: video.created_at,
            lesson: video.lesson,
            teacher: video.teacher,
        }));
    }
    async getFinanceReport() {
        const activeEnrollments = await this.prisma.studentGroup.findMany({
            where: {
                status: 'ACTIVE',
            },
            select: {
                group: {
                    select: {
                        id: true,
                        course: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                            },
                        },
                    },
                },
            },
        });
        const grouped = new Map<number, {
            courseName: string;
            amount: Prisma.Decimal;
        }>();
        for (const row of activeEnrollments) {
            const course = row.group.course;
            const current = grouped.get(course.id);
            if (!current) {
                grouped.set(course.id, {
                    courseName: course.name,
                    amount: course.price,
                });
            }
            else {
                grouped.set(course.id, {
                    courseName: current.courseName,
                    amount: current.amount.add(course.price),
                });
            }
        }
        const byCourse = Array.from(grouped.entries()).map(([courseId, value]) => ({
            courseId,
            courseName: value.courseName,
            totalAmount: value.amount.toString(),
        }));
        const total = byCourse.reduce((acc, item) => acc + Number(item.totalAmount), 0);
        return {
            byCourse,
            totalAmount: total,
            currency: 'UZS',
        };
    }
    async getSuperAdminAnalytics() {
        const [teacherCount, studentCount, groupCount, responseStats] = await Promise.all([
            this.prisma.teacher.count({ where: { status: 'ACTIVE' } }),
            this.prisma.student.count({ where: { status: 'ACTIVE' } }),
            this.prisma.group.count({ where: { status: 'ACTIVE' } }),
            this.prisma.homeworkResponse.groupBy({
                by: ['status'],
                _count: {
                    status: true,
                },
            }),
        ]);
        const finance = await this.getFinanceReport();
        return {
            users: {
                teachers: teacherCount,
                students: studentCount,
            },
            activeGroups: groupCount,
            submissionStats: responseStats,
            finance,
        };
    }
    private async ensureTeacherOwnsLesson(teacherId: number, lessonId: number) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: lessonId },
            select: {
                id: true,
                teacherId: true,
            },
        });
        if (!lesson) {
            throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
        }
        if (lesson.teacherId !== teacherId) {
            throw new ForbiddenException('Teacher can only manage own lessons');
        }
    }
    private async ensureTeacherOwnsHomework(teacherId: number, homeworkId: number) {
        const homework = await this.prisma.homework.findUnique({
            where: { id: homeworkId },
            select: {
                id: true,
                teacherId: true,
            },
        });
        if (!homework) {
            throw new NotFoundException(`Homework with ID ${homeworkId} not found`);
        }
        if (homework.teacherId !== teacherId) {
            throw new ForbiddenException('Teacher can only manage own homework tasks');
        }
        return homework;
    }
    private async ensureTeacherCanManageGroup(teacherId: number, groupId: number) {
        const group = await this.prisma.group.findUnique({
            where: { id: groupId },
            select: {
                id: true,
                teacherId: true,
            },
        });
        if (!group) {
            throw new NotFoundException(`Group with ID ${groupId} not found`);
        }
        if (group.teacherId !== teacherId) {
            throw new ForbiddenException('Teacher can only manage own groups');
        }
    }
    private async ensureStudentExists(studentId: number) {
        const student = await this.prisma.student.findUnique({
            where: { id: studentId },
            select: { id: true },
        });
        if (!student) {
            throw new NotFoundException(`Student with ID ${studentId} not found`);
        }
    }
    private async getStudentGroupIds(studentId: number) {
        const memberships = await this.prisma.studentGroup.findMany({
            where: {
                studentId,
                status: 'ACTIVE',
            },
            select: { groupId: true },
        });
        return memberships.map((membership) => membership.groupId);
    }
}
