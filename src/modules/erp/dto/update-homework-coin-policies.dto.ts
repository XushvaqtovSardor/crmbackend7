import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min, ValidateNested } from 'class-validator';

export class HomeworkCoinTrackPolicyDto {
    @ApiProperty({
        description: 'Awarded coin when approved score is between 60 and 89',
        example: 5,
        minimum: 0,
        maximum: 1000,
    })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(1000)
    coin60To89: number;

    @ApiProperty({
        description: 'Awarded coin when approved score is between 90 and 100',
        example: 7,
        minimum: 0,
        maximum: 1000,
    })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(1000)
    coin90To100: number;
}

export class UpdateHomeworkCoinPoliciesDto {
    @ApiProperty({ type: HomeworkCoinTrackPolicyDto })
    @ValidateNested()
    @Type(() => HomeworkCoinTrackPolicyDto)
    standard: HomeworkCoinTrackPolicyDto;

    @ApiProperty({ type: HomeworkCoinTrackPolicyDto })
    @ValidateNested()
    @Type(() => HomeworkCoinTrackPolicyDto)
    bootcamp: HomeworkCoinTrackPolicyDto;
}
