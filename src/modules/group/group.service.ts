import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException, } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddStudentToGroupDto } from './dto/add-student.dto';
import { UpsertGroupAttendanceDto } from './dto/upsert-group-attendance.dto';
import { Group, Prisma, Role, Status } from '@prisma/client';
@Injectable()
export class GroupService {
    constructor(private readonly prisma: PrismaService) { }
    async create(createGroupDto: CreateGroupDto): Promise<Group> {
        await this.verifyRelatedEntities(createGroupDto);
        try {
            return await this.prisma.group.create({
                data: {
                    ...createGroupDto,
                    startDate: new Date(createGroupDto.startDate),
                },
                include: {
                    course: true,
                    teacher: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            photo: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            role: true,
                        },
                    },
                    room: true,
                },
            });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new ConflictException('Group with this name already exists');
            }
            throw error;
        }
    }
    async findAll(page: number = 1, limit: number = 10, status?: string) {
        const pagination = this.normalizePagination(page, limit);
        const statusFilter = this.parseStatusFilter(status);
        const where = statusFilter ? { status: statusFilter } : {};
        const [data, total] = await Promise.all([
            this.prisma.group.findMany({
                skip: pagination.skip,
                take: pagination.limit,
                where,
                orderBy: { created_at: 'desc' },
                include: {
                    course: true,
                    teacher: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            photo: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            role: true,
                        },
                    },
                    room: true,
                    studentGroup: {
                        where: {
                            status: Status.ACTIVE,
                        },
                        select: {
                            id: true,
                            studentId: true,
                            status: true,
                            student: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    email: true,
                                    status: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            studentGroup: true,
                            lessons: true,
                        },
                    },
                },
            }),
            this.prisma.group.count({ where }),
        ]);
        return {
            data,
            total,
            page: pagination.page,
            totalPages: Math.ceil(total / pagination.limit),
        };
    }
    async findOne(id: number): Promise<any> {
        const group = await this.prisma.group.findUnique({
            where: { id },
            include: {
                course: true,
                teacher: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        photo: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                    },
                },
                room: true,
                studentGroup: {
                    include: {
                        student: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                photo: true,
                                status: true,
                            },
                        },
                    },
                },
                lessons: {
                    where: {
                        title: {
                            not: {
                                startsWith: '__ATTENDANCE__',
                            },
                        },
                    },
                    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
                    include: {
                        lessonVideos: {
                            orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
                            select: {
                                id: true,
                                file: true,
                                created_at: true,
                                teacherId: true,
                                userId: true,
                            },
                        },
                        homework: {
                            orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
                            select: {
                                id: true,
                                title: true,
                                file: true,
                                durationTime: true,
                                deadlineAt: true,
                                maxAttempts: true,
                                allowLateSubmission: true,
                                created_at: true,
                                updated_at: true,
                            },
                        },
                        _count: {
                            select: {
                                lessonVideos: true,
                                homework: true,
                                attendances: true,
                            },
                        },
                    },
                },
            },
        });
        if (!group) {
            throw new NotFoundException(`Group with ID ${id} not found`);
        }
        return group;
    }
    async findMyGroups(userId: number, rawRole: string) {
        const role = String(rawRole || '').trim().toUpperCase() as Role;
        if (role !== Role.TEACHER && role !== Role.STUDENT && role !== Role.SUPERADMIN) {
            throw new ForbiddenException('Only teacher, student or superadmin can access this endpoint');
        }
        const where = role === Role.SUPERADMIN
            ? {}
            : role === Role.TEACHER
                ? { teacherId: userId }
                : {
                    studentGroup: {
                        some: {
                            studentId: userId,
                            status: Status.ACTIVE,
                        },
                    },
                };
        return this.prisma.group.findMany({
            where,
            orderBy: { created_at: 'desc' },
            include: {
                course: true,
                teacher: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        photo: true,
                    },
                },
                room: true,
                studentGroup: {
                    where: {
                        status: Status.ACTIVE,
                    },
                    select: {
                        id: true,
                        studentId: true,
                        status: true,
                        student: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                status: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        studentGroup: true,
                        lessons: true,
                    },
                },
            },
            take: 200,
        });
    }
    async update(id: number, updateGroupDto: UpdateGroupDto): Promise<Group> {
        await this.findOne(id);
        if (Object.keys(updateGroupDto).some((key) => ['teacherId', 'userId', 'roomId', 'courseId'].includes(key))) {
            await this.verifyRelatedEntities(updateGroupDto as any);
        }
        const updateData: any = { ...updateGroupDto };
        if (updateGroupDto.startDate) {
            updateData.startDate = new Date(updateGroupDto.startDate);
        }
        try {
            return await this.prisma.group.update({
                where: { id },
                data: updateData,
                include: {
                    course: true,
                    teacher: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            photo: true,
                        },
                    },
                    room: true,
                },
            });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new ConflictException('Group with this name already exists');
            }
            throw error;
        }
    }
    async remove(id: number): Promise<Group> {
        await this.findOne(id);
        return await this.prisma.group.update({
            where: { id },
            data: { status: 'INACTIVE' },
        });
    }
    async addStudent(groupId: number, addStudentDto: AddStudentToGroupDto) {
        await this.findOne(groupId);
        const student = await this.prisma.student.findUnique({
            where: { id: addStudentDto.studentId },
        });
        if (!student) {
            throw new NotFoundException(`Student with ID ${addStudentDto.studentId} not found`);
        }
        try {
            return await this.prisma.studentGroup.create({
                data: {
                    groupId,
                    studentId: addStudentDto.studentId,
                    userId: addStudentDto.userId,
                },
                include: {
                    student: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                        },
                    },
                },
            });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new ConflictException('Student is already in this group');
            }
            throw error;
        }
    }
    async removeStudent(groupId: number, studentId: number) {
        const studentGroup = await this.prisma.studentGroup.findFirst({
            where: {
                groupId,
                studentId,
            },
        });
        if (!studentGroup) {
            throw new NotFoundException('Student not found in this group');
        }
        return await this.prisma.studentGroup.delete({
            where: { id: studentGroup.id },
        });
    }
    async getAttendance(groupId: number, rawDate?: string) {
        const date = this.normalizeAttendanceDate(rawDate);
        const group = await this.prisma.group.findUnique({
            where: { id: groupId },
            select: {
                id: true,
                name: true,
                studentGroup: {
                    where: {
                        status: Status.ACTIVE,
                    },
                    orderBy: {
                        created_at: 'asc',
                    },
                    select: {
                        id: true,
                        studentId: true,
                        student: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                status: true,
                            },
                        },
                    },
                },
            },
        });
        if (!group) {
            throw new NotFoundException(`Group with ID ${groupId} not found`);
        }
        const lesson = await this.prisma.lesson.findFirst({
            where: {
                groupId,
                title: this.attendanceLessonTitle(date),
            },
            select: {
                id: true,
            },
        });
        const studentIds = group.studentGroup.map((item) => item.studentId);
        const attendances = lesson
            ? await this.prisma.attendance.findMany({
                where: {
                    lessonId: lesson.id,
                    studentId: {
                        in: studentIds.length ? studentIds : [-1],
                    },
                },
                orderBy: {
                    updated_at: 'desc',
                },
                select: {
                    id: true,
                    studentId: true,
                    isPresent: true,
                    updated_at: true,
                },
            })
            : [];
        const attendanceByStudent = new Map<number, {
            id: number;
            isPresent: boolean;
            updated_at: Date;
        }>();
        for (const row of attendances) {
            if (!attendanceByStudent.has(row.studentId)) {
                attendanceByStudent.set(row.studentId, row);
            }
        }
        return {
            groupId: group.id,
            groupName: group.name,
            date,
            lessonId: lesson?.id || null,
            students: group.studentGroup.map((membership) => {
                const attendance = attendanceByStudent.get(membership.studentId);
                return {
                    membershipId: membership.id,
                    studentId: membership.studentId,
                    fullName: membership.student.fullName,
                    email: membership.student.email,
                    status: membership.student.status,
                    isPresent: typeof attendance?.isPresent === 'boolean'
                        ? attendance.isPresent
                        : null,
                    updatedAt: attendance?.updated_at || null,
                };
            }),
        };
    }
    async upsertAttendance(groupId: number, dto: UpsertGroupAttendanceDto) {
        const date = this.normalizeAttendanceDate(dto.date);
        const group = await this.prisma.group.findUnique({
            where: { id: groupId },
            select: {
                id: true,
                teacherId: true,
                studentGroup: {
                    where: {
                        studentId: dto.studentId,
                        status: Status.ACTIVE,
                    },
                    select: {
                        id: true,
                    },
                },
            },
        });
        if (!group) {
            throw new NotFoundException(`Group with ID ${groupId} not found`);
        }
        if (!group.studentGroup.length) {
            throw new BadRequestException('Student is not an active member of this group');
        }
        let lesson = await this.prisma.lesson.findFirst({
            where: {
                groupId,
                title: this.attendanceLessonTitle(date),
            },
            select: {
                id: true,
            },
        });
        if (!lesson) {
            lesson = await this.prisma.lesson.create({
                data: {
                    groupId,
                    title: this.attendanceLessonTitle(date),
                    teacherId: group.teacherId,
                    userId: dto.userId,
                },
                select: {
                    id: true,
                },
            });
        }
        const latestAttendance = await this.prisma.attendance.findFirst({
            where: {
                lessonId: lesson.id,
                studentId: dto.studentId,
            },
            orderBy: {
                updated_at: 'desc',
            },
            select: {
                id: true,
            },
        });
        const payload = {
            isPresent: dto.isPresent,
            teacherId: group.teacherId,
            ...(dto.userId ? { userId: dto.userId } : {}),
        };
        const saved = latestAttendance
            ? await this.prisma.attendance.update({
                where: { id: latestAttendance.id },
                data: payload,
            })
            : await this.prisma.attendance.create({
                data: {
                    lessonId: lesson.id,
                    studentId: dto.studentId,
                    ...payload,
                },
            });
        return {
            id: saved.id,
            groupId,
            studentId: dto.studentId,
            date,
            isPresent: saved.isPresent,
            updatedAt: saved.updated_at,
        };
    }
    async resetAttendance(groupId: number, rawDate: string, studentId?: number) {
        const date = this.normalizeAttendanceDate(rawDate);
        const group = await this.prisma.group.findUnique({
            where: { id: groupId },
            select: {
                id: true,
                studentGroup: {
                    where: {
                        status: Status.ACTIVE,
                        ...(studentId ? { studentId } : {}),
                    },
                    select: {
                        studentId: true,
                    },
                },
            },
        });
        if (!group) {
            throw new NotFoundException(`Group with ID ${groupId} not found`);
        }
        if (studentId && !group.studentGroup.length) {
            throw new BadRequestException('Student is not an active member of this group');
        }
        const lesson = await this.prisma.lesson.findFirst({
            where: {
                groupId,
                title: this.attendanceLessonTitle(date),
            },
            select: {
                id: true,
            },
        });
        if (!lesson) {
            return {
                groupId,
                date,
                removed: 0,
            };
        }
        const allowedIds = group.studentGroup.map((item) => item.studentId);
        const deleteResult = await this.prisma.attendance.deleteMany({
            where: {
                lessonId: lesson.id,
                studentId: {
                    in: allowedIds.length ? allowedIds : [-1],
                },
            },
        });
        return {
            groupId,
            date,
            removed: deleteResult.count,
            studentId: studentId || null,
        };
    }
    private attendanceLessonTitle(date: string) {
        return `__ATTENDANCE__ ${date}`;
    }
    private normalizeAttendanceDate(rawDate?: string) {
        const parsed = rawDate ? new Date(rawDate) : new Date();
        if (Number.isNaN(parsed.getTime())) {
            throw new BadRequestException('Invalid attendance date');
        }
        const year = parsed.getUTCFullYear();
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    private async verifyRelatedEntities(dto: Partial<CreateGroupDto>) {
        if (dto.teacherId) {
            const teacher = await this.prisma.teacher.findUnique({
                where: { id: dto.teacherId },
            });
            if (!teacher) {
                throw new BadRequestException(`Teacher with ID ${dto.teacherId} not found`);
            }
        }
        if (dto.roomId) {
            const room = await this.prisma.room.findUnique({
                where: { id: dto.roomId },
            });
            if (!room) {
                throw new BadRequestException(`Room with ID ${dto.roomId} not found`);
            }
        }
        if (dto.courseId) {
            const course = await this.prisma.course.findUnique({
                where: { id: dto.courseId },
            });
            if (!course) {
                throw new BadRequestException(`Course with ID ${dto.courseId} not found`);
            }
        }
        if (dto.userId) {
            const user = await this.prisma.user.findUnique({
                where: { id: dto.userId },
            });
            if (!user) {
                throw new BadRequestException(`User with ID ${dto.userId} not found`);
            }
        }
    }
    private parseStatusFilter(status?: string): Status | undefined {
        if (!status) {
            return undefined;
        }
        const normalized = status.toUpperCase();
        if (!Object.values(Status).includes(normalized as Status)) {
            throw new BadRequestException(`Invalid status filter. Allowed values: ${Object.values(Status).join(', ')}`);
        }
        return normalized as Status;
    }
    private normalizePagination(page = 1, limit = 10) {
        const safePage = Number.isInteger(page) && page > 0 ? page : 1;
        const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
        return {
            page: safePage,
            limit: safeLimit,
            skip: (safePage - 1) * safeLimit,
        };
    }
}
