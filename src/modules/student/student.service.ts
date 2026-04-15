import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../common/notifications';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Student, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    const { phone, password, ...studentData } = createStudentDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const student = await this.prisma.student.create({
        data: {
          ...studentData,
          phone: phone || null,
          password: hashedPassword,
          birth_date: new Date(studentData.birth_date),
        },
      });

      await this.notificationService.sendCredentials({
        toEmail: student.email,
        toPhone: phone,
        fullName: student.fullName,
        login: student.email,
        password,
        accountType: 'STUDENT',
      });

      // Remove password from response
      delete (student as any).password;
      return student;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Student with this email or phone already exists');
      }
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 10, status?: string) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
    const skip = (safePage - 1) * safeLimit;
    const where = status ? { status: status as any } : {};

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        skip,
        take: safeLimit,
        where,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          photo: true,
          birth_date: true,
          status: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              studentGroups: true,
              attendances: true,
              homeworkResults: true,
            },
          },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findOne(id: number): Promise<any> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        photo: true,
        birth_date: true,
        status: true,
        created_at: true,
        updated_at: true,
        studentGroups: {
          include: {
            group: {
              include: {
                course: true,
                teacher: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        attendances: {
          take: 10,
          orderBy: { created_at: 'desc' },
        },
        homeworkResults: {
          take: 10,
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    return student;
  }

  async update(
    id: number,
    updateStudentDto: UpdateStudentDto,
  ): Promise<Student> {
    await this.findOne(id);

    const { phone, ...rest } = updateStudentDto as UpdateStudentDto & {
      phone?: string;
    };
    const updateData: any = { ...rest };

    if (updateStudentDto.password) {
      updateData.password = await bcrypt.hash(updateStudentDto.password, 10);
    }

    if (updateStudentDto.birth_date) {
      updateData.birth_date = new Date(updateStudentDto.birth_date);
    }

    if (typeof phone !== 'undefined') {
      updateData.phone = phone || null;
    }

    try {
      const student = await this.prisma.student.update({
        where: { id },
        data: updateData,
      });

      delete (student as any).password;
      return student;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Student with this email or phone already exists');
      }
      throw error;
    }
  }

  async remove(id: number): Promise<Student> {
    await this.findOne(id);

    const student = await this.prisma.student.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    delete (student as any).password;
    return student;
  }

  async search(query: string): Promise<any[]> {
    const sanitizedQuery = String(query || '').trim();
    if (!sanitizedQuery) {
      return [];
    }

    return await this.prisma.student.findMany({
      where: {
        OR: [
          { fullName: { contains: sanitizedQuery, mode: 'insensitive' } },
          { email: { contains: sanitizedQuery, mode: 'insensitive' } },
          { phone: { contains: sanitizedQuery, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        photo: true,
        status: true,
      },
      take: 20,
    });
  }
}
