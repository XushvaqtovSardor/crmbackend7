import { IsString, IsInt, IsEnum, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class CreateRoomDto {
  @ApiProperty({ description: 'Room name', example: 'A-101' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Max room capacity',
    example: 18,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiPropertyOptional({
    description: 'Room status',
    enum: Status,
    example: Status.ACTIVE,
  })
  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}
