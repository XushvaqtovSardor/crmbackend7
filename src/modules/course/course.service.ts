import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Course, Prisma } from '@prisma/client';

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCourseDto: CreateCourseDto): Promise<Course> {
    try {
      return await this.prisma.course.create({
        data: createCourseDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Course with this name already exists');
      }
      throw error;
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Course[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: { groups: true },
          },
        },
      }),
      this.prisma.course.count(),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Course> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        groups: {
          include: {
            teacher: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            room: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return course;
  }

  async update(id: number, updateCourseDto: UpdateCourseDto): Promise<Course> {
    await this.findOne(id);

    try {
      return await this.prisma.course.update({
        where: { id },
        data: updateCourseDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Course with this name already exists');
      }
      throw error;
    }
  }

  async remove(id: number): Promise<Course> {
    await this.findOne(id);

    return await this.prisma.course.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async search(query: string): Promise<Course[]> {
    return await this.prisma.course.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
  }
}
