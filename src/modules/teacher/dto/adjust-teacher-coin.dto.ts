import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export enum TeacherCoinOperation {
  INCREMENT = 'INCREMENT',
  DECREMENT = 'DECREMENT',
}

export class AdjustTeacherCoinDto {
  @ApiProperty({
    description: 'Coin operation type',
    enum: TeacherCoinOperation,
    example: TeacherCoinOperation.INCREMENT,
  })
  @IsEnum(TeacherCoinOperation)
  operation: TeacherCoinOperation;

  @ApiProperty({
    description: 'Coin amount to apply',
    example: 10,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({
    description: 'Optional reason for coin operation',
    example: 'Monthly bonus',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  reason?: string;
}
