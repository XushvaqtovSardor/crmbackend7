import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, } from '@nestjs/common';
import { CoinTransactionType, HomeworkCoinTrack, HomeworkStatus, HomeworkStatusStudent, Prisma, Role } from '@prisma/client';
import { NotificationService } from '../../common/notifications';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignHomeworkDto } from './dto/assign-homework.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { PublishVideoDto } from './dto/publish-video.dto';
import { ReviewHomeworkDto } from './dto/review-homework.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';
import { UpdateHomeworkCoinPoliciesDto } from './dto/update-homework-coin-policies.dto';
import { UpdateHomeworkPolicyDto } from './dto/update-homework-policy.dto';
@Injectable()
export class ErpService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
    ) { }
    async createLesson(actorId: number, actorRole: Role, dto: CreateLessonDto) {
        const managedGroup = await this.ensureGroupExists(dto.groupId);

        if (!this.isSuperAdmin(actorRole)) {
            await this.ensureTeacherCanManageGroup(actorId, dto.groupId);
        }

        const ownerTeacherId = this.isSuperAdmin(actorRole)
            ? managedGroup.teacherId
            : actorId;

        return this.prisma.lesson.create({
            data: {
                groupId: dto.groupId,
                title: dto.title,
                teacherId: ownerTeacherId,
                userId: this.isSuperAdmin(actorRole) ? actorId : undefined,
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
    async publishVideo(actorId: number, actorRole: Role, dto: PublishVideoDto) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: dto.lessonId },
            select: {
                id: true,
                teacherId: true,
                group: {
                    select: {
                        teacherId: true,
                    },
                },
            },
        });
        if (!lesson) {
            throw new NotFoundException(`Lesson with ID ${dto.lessonId} not found`);
        }
        if (!this.isSuperAdmin(actorRole) && lesson.teacherId !== actorId) {
            throw new ForbiddenException('You can only upload videos for your own lessons');
        }

        if (!this.isValidVideoAttachment(dto.file)) {
            throw new BadRequestException('Video uchun faqat video fayl yoki video link biriktirilishi mumkin');
        }

        const ownerTeacherId = this.isSuperAdmin(actorRole)
            ? (lesson.teacherId ?? lesson.group?.teacherId ?? null)
            : actorId;

        return this.prisma.lessonVideo.create({
            data: {
                lessonId: dto.lessonId,
                teacherId: ownerTeacherId,
                userId: this.isSuperAdmin(actorRole) ? actorId : undefined,
                file: dto.file,
            },
        });
    }
    async assignHomework(actorId: number, actorRole: Role, dto: AssignHomeworkDto) {
        const lesson = await this.ensureLessonExists(dto.lessonId);

        if (!this.isSuperAdmin(actorRole)) {
            await this.ensureTeacherOwnsLesson(actorId, dto.lessonId);
        }

        const deadlineAt = new Date(dto.deadlineAt);
        if (Number.isNaN(deadlineAt.getTime())) {
            throw new BadRequestException('Invalid deadlineAt date');
        }

        const ownerTeacherId = this.isSuperAdmin(actorRole)
            ? (lesson.teacherId ?? lesson.group?.teacherId ?? null)
            : actorId;

        return this.prisma.homework.create({
            data: {
                lessonId: dto.lessonId,
                teacherId: ownerTeacherId,
                userId: this.isSuperAdmin(actorRole) ? actorId : undefined,
                title: dto.title,
                file: dto.file,
                durationTime: dto.durationTime,
                deadlineAt,
                maxAttempts: dto.maxAttempts || 1,
                allowLateSubmission: dto.allowLateSubmission || false,
            },
        });
    }
    async updateHomeworkPolicy(actorId: number, actorRole: Role, homeworkId: number, dto: UpdateHomeworkPolicyDto) {
        if (!this.isSuperAdmin(actorRole)) {
            await this.ensureTeacherOwnsHomework(actorId, homeworkId);
        } else {
            await this.ensureHomeworkExists(homeworkId);
        }

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
    async getHomeworkSubmissions(actorId: number, actorRole: Role, homeworkId: number) {
        if (!this.isSuperAdmin(actorRole)) {
            await this.ensureTeacherOwnsHomework(actorId, homeworkId);
        } else {
            await this.ensureHomeworkExists(homeworkId);
        }

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
                    teacherCoinAward: true,
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
    async reviewHomework(actorId: number, actorRole: Role, dto: ReviewHomeworkDto) {
        const homework = await this.prisma.homework.findUnique({
            where: { id: dto.homeworkId },
            select: {
                id: true,
                title: true,
                teacherId: true,
                lesson: {
                    select: {
                        group: {
                            select: {
                                name: true,
                                course: {
                                    select: {
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!homework) {
            throw new NotFoundException(`Homework with ID ${dto.homeworkId} not found`);
        }

        if (!this.isSuperAdmin(actorRole) && homework.teacherId !== actorId) {
            throw new ForbiddenException('Teacher can only manage own homework tasks');
        }

        const homeworkTeacherId = homework.teacherId ?? null;
        const coinTrack = this.resolveHomeworkCoinTrack(
            homework.lesson?.group?.name,
            homework.lesson?.group?.course?.name,
        );

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
            select: {
                id: true,
                score: true,
                status: true,
                teacherCoinAward: true,
            },
        });

        const reviewOutcome = await this.prisma.$transaction(async (tx) => {
            const coinPolicy = await this.getHomeworkCoinPolicyByTrack(tx, coinTrack);

            const previousAward = existingResult
                ? (existingResult.teacherCoinAward
                    ?? this.resolveCoinAward(existingResult.score, existingResult.status, coinPolicy))
                : 0;
            const nextAward = this.resolveCoinAward(dto.score, dto.status, coinPolicy);
            const coinDelta = nextAward - previousAward;

            const resultPayload = {
                homeworkId: dto.homeworkId,
                studentId: dto.studentId,
                teacherId: this.isSuperAdmin(actorRole) ? homeworkTeacherId : actorId,
                userId: this.isSuperAdmin(actorRole) ? actorId : undefined,
                title: latestResponse.title,
                file: latestResponse.file,
                score: dto.score,
                status: dto.status,
                teacherCoinAward: nextAward,
            };

            const gradedResult = existingResult
                ? await tx.homeworkResult.update({
                    where: { id: existingResult.id },
                    data: resultPayload,
                })
                : await tx.homeworkResult.create({ data: resultPayload });

            const reviewedResponse = await tx.homeworkResponse.update({
                where: { id: latestResponse.id },
                data: {
                    feedback: dto.feedback,
                    reviewedAt: new Date(),
                },
            });

            let transaction: {
                id: number;
                type: CoinTransactionType;
                amount: number;
                balanceAfter: number;
                reason: string | null;
                created_at: Date;
            } | null = null;

            if (homeworkTeacherId && coinDelta !== 0) {
                const teacher = await tx.teacher.findUnique({
                    where: { id: homeworkTeacherId },
                    select: {
                        id: true,
                        coinBalance: true,
                    },
                });

                if (!teacher) {
                    throw new NotFoundException(`Teacher with ID ${homeworkTeacherId} not found`);
                }

                const nextBalance = teacher.coinBalance + coinDelta;
                if (nextBalance < 0) {
                    throw new BadRequestException('Teacher coin balance cannot be negative after review update');
                }

                await tx.teacher.update({
                    where: { id: homeworkTeacherId },
                    data: {
                        coinBalance: nextBalance,
                    },
                });

                transaction = await tx.teacherCoinTransaction.create({
                    data: {
                        teacherId: homeworkTeacherId,
                        type: coinDelta > 0 ? CoinTransactionType.CREDIT : CoinTransactionType.DEBIT,
                        amount: Math.abs(coinDelta),
                        balanceAfter: nextBalance,
                        reason: `Homework review reward (${coinTrack}) • Homework #${dto.homeworkId} • Student #${dto.studentId} • Score ${dto.score}`,
                        createdBy: actorId,
                    },
                    select: {
                        id: true,
                        type: true,
                        amount: true,
                        balanceAfter: true,
                        reason: true,
                        created_at: true,
                    },
                });
            }

            return {
                gradedResult,
                reviewedResponse,
                coinTrack,
                previousAward,
                nextAward,
                coinDelta,
                transaction,
            };
        });

        await this.sendHomeworkReviewStudentNotification({
            studentId: dto.studentId,
            homeworkTitle: homework.title || latestResponse.title || `Homework #${dto.homeworkId}`,
            score: dto.score,
            status: dto.status,
            teacherCoinAward: reviewOutcome.nextAward,
        });

        const resultPayload = {
            gradedResult: reviewOutcome.gradedResult,
            reviewedResponse: reviewOutcome.reviewedResponse,
            coin: {
                track: reviewOutcome.coinTrack,
                previousAward: reviewOutcome.previousAward,
                awarded: reviewOutcome.nextAward,
                delta: reviewOutcome.coinDelta,
                transaction: reviewOutcome.transaction,
            },
        };

        return resultPayload;
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
                    teacherCoinAward: true,
                    created_at: true,
                    updated_at: true,
                },
            }),
        ]);
        const latestGradeByHomework = new Map<number, {
            score: number;
            status: HomeworkStatus;
            teacherCoinAward: number;
            created_at: Date;
            updated_at: Date;
        }>();
        for (const grade of grades) {
            if (!latestGradeByHomework.has(grade.homeworkId)) {
                latestGradeByHomework.set(grade.homeworkId, {
                    score: grade.score,
                    status: grade.status,
                    teacherCoinAward: grade.teacherCoinAward || 0,
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
                teacherCoinAward: grade?.teacherCoinAward || 0,
            };
        });
        const gradeRows = grades.map((grade) => ({
            id: grade.id,
            homeworkId: grade.homeworkId,
            title: grade.title || `Homework #${grade.homeworkId}`,
            score: grade.score,
            status: grade.status,
            teacherCoinAward: grade.teacherCoinAward || 0,
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
    async getHomeworkCoinPolicies() {
        const policies = await this.ensureHomeworkCoinPolicies();
        return this.mapHomeworkCoinPolicies(policies);
    }
    async updateHomeworkCoinPolicies(actorId: number, dto: UpdateHomeworkCoinPoliciesDto) {
        if (dto.standard.coin90To100 < dto.standard.coin60To89) {
            throw new BadRequestException('Standard siyosatda 90-100 coin qiymati 60-89 dan kichik bo\'lmasligi kerak');
        }

        if (dto.bootcamp.coin90To100 < dto.bootcamp.coin60To89) {
            throw new BadRequestException('Bootcamp siyosatda 90-100 coin qiymati 60-89 dan kichik bo\'lmasligi kerak');
        }

        return this.prisma.$transaction(async (tx) => {
            await this.ensureHomeworkCoinPolicies(tx);

            await Promise.all([
                tx.homeworkCoinPolicy.update({
                    where: { track: HomeworkCoinTrack.STANDARD },
                    data: {
                        coin60To89: dto.standard.coin60To89,
                        coin90To100: dto.standard.coin90To100,
                        updatedBy: actorId,
                    },
                }),
                tx.homeworkCoinPolicy.update({
                    where: { track: HomeworkCoinTrack.BOOTCAMP },
                    data: {
                        coin60To89: dto.bootcamp.coin60To89,
                        coin90To100: dto.bootcamp.coin90To100,
                        updatedBy: actorId,
                    },
                }),
            ]);

            const updated = await tx.homeworkCoinPolicy.findMany();
            return this.mapHomeworkCoinPolicies(updated);
        });
    }
    private getDefaultHomeworkCoinPolicy(track: HomeworkCoinTrack) {
        if (track === HomeworkCoinTrack.BOOTCAMP) {
            return {
                track,
                coin60To89: 5,
                coin90To100: 7,
            };
        }

        return {
            track,
            coin60To89: 5,
            coin90To100: 7,
        };
    }
    private mapHomeworkCoinPolicies(rows: Array<{
        track: HomeworkCoinTrack;
        coin60To89: number;
        coin90To100: number;
    }>) {
        const standard = rows.find((row) => row.track === HomeworkCoinTrack.STANDARD)
            || this.getDefaultHomeworkCoinPolicy(HomeworkCoinTrack.STANDARD);
        const bootcamp = rows.find((row) => row.track === HomeworkCoinTrack.BOOTCAMP)
            || this.getDefaultHomeworkCoinPolicy(HomeworkCoinTrack.BOOTCAMP);

        return {
            standard: {
                coin60To89: standard.coin60To89,
                coin90To100: standard.coin90To100,
            },
            bootcamp: {
                coin60To89: bootcamp.coin60To89,
                coin90To100: bootcamp.coin90To100,
            },
        };
    }
    private async ensureHomeworkCoinPolicies(tx: PrismaService | Prisma.TransactionClient = this.prisma) {
        const current = await tx.homeworkCoinPolicy.findMany();
        const tracks = new Set(current.map((row) => row.track));
        const createRows: Array<{
            track: HomeworkCoinTrack;
            coin60To89: number;
            coin90To100: number;
        }> = [];

        if (!tracks.has(HomeworkCoinTrack.STANDARD)) {
            createRows.push(this.getDefaultHomeworkCoinPolicy(HomeworkCoinTrack.STANDARD));
        }
        if (!tracks.has(HomeworkCoinTrack.BOOTCAMP)) {
            createRows.push(this.getDefaultHomeworkCoinPolicy(HomeworkCoinTrack.BOOTCAMP));
        }

        if (createRows.length > 0) {
            await tx.homeworkCoinPolicy.createMany({
                data: createRows,
            });
        }

        if (createRows.length === 0) {
            return current;
        }

        return tx.homeworkCoinPolicy.findMany();
    }
    private async getHomeworkCoinPolicyByTrack(
        tx: PrismaService | Prisma.TransactionClient,
        track: HomeworkCoinTrack,
    ) {
        const policies = await this.ensureHomeworkCoinPolicies(tx);
        return policies.find((item) => item.track === track)
            || this.getDefaultHomeworkCoinPolicy(track);
    }
    private resolveHomeworkCoinTrack(groupName?: string | null, courseName?: string | null) {
        const source = `${String(groupName || '')} ${String(courseName || '')}`.toLowerCase();
        return source.includes('bootcamp')
            ? HomeworkCoinTrack.BOOTCAMP
            : HomeworkCoinTrack.STANDARD;
    }
    private resolveCoinAward(
        score: number,
        status: HomeworkStatus,
        policy: {
            coin60To89: number;
            coin90To100: number;
        },
    ) {
        if (status !== HomeworkStatus.APPROVED) {
            return 0;
        }

        if (score >= 90 && score <= 100) {
            return policy.coin90To100;
        }

        if (score >= 60 && score < 90) {
            return policy.coin60To89;
        }

        return 0;
    }
    private async sendHomeworkReviewStudentNotification(payload: {
        studentId: number;
        homeworkTitle: string;
        score: number;
        status: HomeworkStatus;
        teacherCoinAward: number;
    }) {
        const student = await this.prisma.student.findUnique({
            where: { id: payload.studentId },
            select: {
                fullName: true,
                email: true,
                phone: true,
            },
        });

        if (!student) {
            return;
        }

        if (!student.email && !student.phone) {
            return;
        }

        try {
            await this.notificationService.sendHomeworkReviewNotice({
                toEmail: student.email || undefined,
                toPhone: student.phone || undefined,
                fullName: student.fullName,
                homeworkTitle: payload.homeworkTitle,
                score: payload.score,
                status: payload.status,
                teacherCoinAward: payload.teacherCoinAward,
            });
        } catch {
            // Non-blocking notification send.
        }
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
    private async ensureGroupExists(groupId: number) {
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

        return group;
    }
    private async ensureLessonExists(lessonId: number) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: lessonId },
            select: {
                id: true,
                teacherId: true,
                group: {
                    select: {
                        teacherId: true,
                    },
                },
            },
        });

        if (!lesson) {
            throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
        }

        return lesson;
    }
    private async ensureHomeworkExists(homeworkId: number) {
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

        return homework;
    }
    private isSuperAdmin(role: Role) {
        return role === Role.SUPERADMIN;
    }

    private isValidVideoAttachment(value: string) {
        const raw = String(value || '').trim();
        if (!raw) return false;

        const parsed = this.parseAttachment(raw);
        const candidates = [parsed.link, parsed.fileName, raw]
            .map((item) => String(item || '').trim())
            .filter(Boolean);

        return candidates.some((item) => this.isVideoSource(item));
    }

    private parseAttachment(value: string) {
        const raw = String(value || '').trim();

        if (!raw || !raw.startsWith('{')) {
            return {
                fileName: '',
                link: '',
            };
        }

        try {
            const parsed = JSON.parse(raw) as {
                type?: string;
                fileName?: string;
                link?: string;
            };

            if (parsed?.type !== 'attachment-v1') {
                return {
                    fileName: '',
                    link: '',
                };
            }

            return {
                fileName: String(parsed.fileName || '').trim(),
                link: String(parsed.link || '').trim(),
            };
        } catch {
            return {
                fileName: '',
                link: '',
            };
        }
    }

    private isVideoSource(source: string) {
        const normalized = String(source || '').trim().toLowerCase();
        if (!normalized) return false;

        const withoutQuery = normalized.split('?')[0];
        return /(\.mp4|\.webm|\.mov|\.m4v|\.avi|\.mkv|\.ogg)$/.test(withoutQuery);
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
