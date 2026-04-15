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
  constructor(private readonly prisma: PrismaService) { }

  /** Creates a new course and protects unique name constraints. */
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

  /** Returns paginated course list with lightweight relation counters. */
  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Course[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const pagination = this.normalizePagination(page, limit);

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        skip: pagination.skip,
        take: pagination.limit,
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
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  /** Loads full course details and nested group links by course id. */
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

  /** Updates existing course while preserving unique-name guarantee. */
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

  /** Soft-deactivates a course to preserve historical references. */
  async remove(id: number): Promise<Course> {
    await this.findOne(id);

    return await this.prisma.course.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  /** Performs case-insensitive search by course name/description. */
  async search(query: string): Promise<Course[]> {
    const sanitizedQuery = query?.trim();
    if (!sanitizedQuery) {
      return [];
    }

    return await this.prisma.course.findMany({
      where: {
        OR: [
          { name: { contains: sanitizedQuery, mode: 'insensitive' } },
          { description: { contains: sanitizedQuery, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
  }

  /** Normalizes pagination params and enforces safe API limits. */
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
