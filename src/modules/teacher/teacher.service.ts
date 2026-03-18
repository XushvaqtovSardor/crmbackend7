import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../common/notifications';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TeacherService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) { }

  async create(createTeacherDto: CreateTeacherDto) {
    const { phone, password, ...teacherData } = createTeacherDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const teacher = await this.prisma.teacher.create({
        data: {
          ...teacherData,
          password: hashedPassword,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          photo: true,
          position: true,
          experience: true,
          status: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              groups: true,
            },
          },
        },
      });

      await this.notificationService.sendCredentials({
        toEmail: teacher.email,
        toPhone: phone,
        fullName: teacher.fullName,
        login: teacher.email,
        password,
        accountType: 'TEACHER',
      });

      return teacher;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Teacher with this email already exists');
      }
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 10, status?: string) {
    const skip = (page - 1) * limit;

    const where: any = status ? { status } : {};

    const [data, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          photo: true,
          position: true,
          experience: true,
          status: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              groups: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        photo: true,
        position: true,
        experience: true,
        status: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            groups: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }

    return teacher;
  }

  async update(id: number, updateTeacherDto: UpdateTeacherDto) {
    await this.findOne(id);

    const updateData: any = { ...updateTeacherDto };

    if (updateTeacherDto.password) {
      updateData.password = await bcrypt.hash(updateTeacherDto.password, 10);
    }

    try {
      return await this.prisma.teacher.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          fullName: true,
          email: true,
          photo: true,
          position: true,
          experience: true,
          status: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              groups: true,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Teacher with this email already exists');
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.teacher.delete({
      where: { id },
    });
  }

  async search(query: string) {
    return this.prisma.teacher.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { position: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        photo: true,
        position: true,
        experience: true,
        status: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            groups: true,
          },
        },
      },
    });
  }
}
