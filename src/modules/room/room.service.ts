import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, Prisma } from '@prisma/client';

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoomDto: CreateRoomDto): Promise<Room> {
    try {
      return await this.prisma.room.create({
        data: createRoomDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Room with this name already exists');
      }
      throw error;
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: Room[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.room.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: { groups: true },
          },
        },
      }),
      this.prisma.room.count(),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Room> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        groups: {
          include: {
            course: true,
            teacher: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    return room;
  }

  async update(id: number, updateRoomDto: UpdateRoomDto): Promise<Room> {
    await this.findOne(id);

    try {
      return await this.prisma.room.update({
        where: { id },
        data: updateRoomDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Room with this name already exists');
      }
      throw error;
    }
  }

  async remove(id: number): Promise<Room> {
    await this.findOne(id);

    return await this.prisma.room.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }
}
