import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddStudentToGroupDto } from './dto/add-student.dto';
import { Group, Prisma } from '@prisma/client';

@Injectable()
export class GroupService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createGroupDto: CreateGroupDto): Promise<Group> {
    // Verify related entities exist
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
            },
          },
          room: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Group with this name already exists');
      }
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 10, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [data, total] = await Promise.all([
      this.prisma.group.findMany({
        skip,
        take: limit,
        where,
        orderBy: { created_at: 'desc' },
        include: {
          course: true,
          teacher: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          room: true,
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
      page,
      totalPages: Math.ceil(total / limit),
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
          take: 10,
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${id} not found`);
    }

    return group;
  }

  async update(id: number, updateGroupDto: UpdateGroupDto): Promise<Group> {
    await this.findOne(id);

    if (
      Object.keys(updateGroupDto).some((key) =>
        ['teacherId', 'userId', 'roomId', 'courseId'].includes(key),
      )
    ) {
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
            },
          },
          room: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
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
    const group = await this.findOne(groupId);

    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: addStudentDto.studentId },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with ID ${addStudentDto.studentId} not found`,
      );
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
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

  private async verifyRelatedEntities(dto: Partial<CreateGroupDto>) {
    if (dto.teacherId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: dto.teacherId },
      });
      if (!teacher) {
        throw new BadRequestException(
          `Teacher with ID ${dto.teacherId} not found`,
        );
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
        throw new BadRequestException(
          `Course with ID ${dto.courseId} not found`,
        );
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
}
