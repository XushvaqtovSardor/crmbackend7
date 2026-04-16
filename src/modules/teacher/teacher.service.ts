import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CoinTransactionType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../common/notifications';
import { AdjustTeacherCoinDto, TeacherCoinOperation } from './dto/adjust-teacher-coin.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class TeacherService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) { }

  private teacherSelect() {
    return {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      birth_date: true,
      photo: true,
      position: true,
      experience: true,
      status: true,
      coinBalance: true,
      createdBy: true,
      created_at: true,
      updated_at: true,
      createdByUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      _count: {
        select: {
          groups: true,
          coinTransactions: true,
        },
      },
    } as const;
  }

  async create(createTeacherDto: CreateTeacherDto, createdBy?: number | null) {
    const { phone, birth_date, password, ...teacherData } = createTeacherDto;

    if (!String(phone || '').trim()) {
      throw new BadRequestException('Teacher phone is required for SMS credentials');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const teacher = await this.prisma.teacher.create({
        data: {
          ...teacherData,
          phone: phone || null,
          birth_date: birth_date ? new Date(birth_date) : null,
          createdBy: createdBy || null,
          password: hashedPassword,
        },
        select: this.teacherSelect(),
      });

      await this.notificationService.sendCredentials({
        toEmail: teacher.email,
        toPhone: phone,
        fullName: teacher.fullName,
        login: phone || teacher.email,
        password,
        accountType: 'TEACHER',
      });

      return teacher;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Teacher with this email or phone already exists');
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
          ...this.teacherSelect(),
          groups: {
            take: 5,
            orderBy: {
              created_at: 'desc',
            },
            select: {
              id: true,
              name: true,
              status: true,
              course: {
                select: {
                  id: true,
                  name: true,
                },
              },
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
        ...this.teacherSelect(),
        groups: {
          take: 10,
          orderBy: {
            created_at: 'desc',
          },
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            startTime: true,
            weekDays: true,
            course: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
            room: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                studentGroup: true,
              },
            },
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

    const { birth_date, phone, ...rest } = updateTeacherDto;
    const updateData: Prisma.TeacherUpdateInput = { ...rest };

    if (updateTeacherDto.password) {
      updateData.password = await bcrypt.hash(updateTeacherDto.password, 10);
    }

    if (typeof phone !== 'undefined') {
      updateData.phone = phone || null;
    }

    if (typeof birth_date !== 'undefined') {
      updateData.birth_date = birth_date ? new Date(birth_date) : null;
    }

    try {
      return await this.prisma.teacher.update({
        where: { id },
        data: updateData,
        select: this.teacherSelect(),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Teacher with this email or phone already exists');
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.teacher.update({
      where: { id },
      data: { status: 'INACTIVE' },
      select: this.teacherSelect(),
    });
  }

  async search(query: string) {
    return this.prisma.teacher.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { position: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        ...this.teacherSelect(),
        groups: {
          take: 3,
          orderBy: {
            created_at: 'desc',
          },
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 50,
    });
  }

  async getProfile(id: number) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      select: {
        ...this.teacherSelect(),
        groups: {
          where: {
            status: 'ACTIVE',
          },
          orderBy: {
            created_at: 'desc',
          },
          include: {
            course: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
            room: {
              select: {
                id: true,
                name: true,
                capacity: true,
              },
            },
            _count: {
              select: {
                studentGroup: true,
              },
            },
            studentGroup: {
              where: {
                status: 'ACTIVE',
              },
              orderBy: {
                created_at: 'asc',
              },
              select: {
                id: true,
                created_at: true,
                student: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    photo: true,
                    birth_date: true,
                    status: true,
                    created_at: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }

    const [coinByType, transactionCount, recentTransactions] = await Promise.all([
      this.prisma.teacherCoinTransaction.groupBy({
        by: ['type'],
        where: { teacherId: id },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.teacherCoinTransaction.count({
        where: { teacherId: id },
      }),
      this.prisma.teacherCoinTransaction.findMany({
        where: { teacherId: id },
        orderBy: { created_at: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          reason: true,
          created_at: true,
          createdByUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const totalGiven =
      coinByType.find((row) => row.type === CoinTransactionType.CREDIT)?._sum
        .amount || 0;
    const totalSpent =
      coinByType.find((row) => row.type === CoinTransactionType.DEBIT)?._sum
        .amount || 0;

    const { groups, ...teacherInfo } = teacher;

    const mappedGroups = groups.map((group) => ({
      ...group,
      studentCount: group._count.studentGroup,
      students: group.studentGroup.map((member) => member.student),
    }));

    return {
      teacher: teacherInfo,
      groups: mappedGroups,
      coin: {
        balance: teacher.coinBalance,
        totalGiven,
        totalSpent,
        totalTransactions: transactionCount,
        recentTransactions,
      },
    };
  }

  async getCoinHistory(id: number, page: number = 1, limit: number = 20) {
    await this.ensureTeacherExists(id);

    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      this.prisma.teacherCoinTransaction.findMany({
        where: { teacherId: id },
        skip,
        take: safeLimit,
        orderBy: {
          created_at: 'desc',
        },
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          reason: true,
          created_at: true,
          createdByUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.teacherCoinTransaction.count({
        where: { teacherId: id },
      }),
    ]);

    return {
      data,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async adjustCoin(
    id: number,
    dto: AdjustTeacherCoinDto,
    actorId?: number | null,
  ) {
    const teacher = await this.ensureTeacherExists(id);

    const delta =
      dto.operation === TeacherCoinOperation.INCREMENT ? dto.amount : -dto.amount;
    const nextBalance = teacher.coinBalance + delta;

    if (nextBalance < 0) {
      throw new BadRequestException('Coin balance cannot be negative');
    }

    const transactionType =
      delta >= 0 ? CoinTransactionType.CREDIT : CoinTransactionType.DEBIT;

    const [updatedTeacher, transaction] = await this.prisma.$transaction([
      this.prisma.teacher.update({
        where: { id },
        data: { coinBalance: nextBalance },
        select: this.teacherSelect(),
      }),
      this.prisma.teacherCoinTransaction.create({
        data: {
          teacherId: id,
          type: transactionType,
          amount: Math.abs(delta),
          balanceAfter: nextBalance,
          reason: dto.reason || null,
          createdBy: actorId || null,
        },
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          reason: true,
          created_at: true,
          createdByUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      teacher: updatedTeacher,
      transaction,
    };
  }

  private async ensureTeacherExists(id: number) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        coinBalance: true,
      },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }

    return teacher;
  }
}
