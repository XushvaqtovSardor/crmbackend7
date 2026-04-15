import {
    BadRequestException,
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Headers,
    Query,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiHeader,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { TeacherService } from './teacher.service';
import { AdjustTeacherCoinDto } from './dto/adjust-teacher-coin.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Controller('teachers')
@ApiTags('teachers')
export class TeacherController {
    constructor(private readonly teacherService: TeacherService) { }

    @Post()
    @ApiOperation({ summary: 'Create teacher' })
    @ApiBody({ type: CreateTeacherDto })
    @ApiResponse({ status: 201, description: 'Teacher created' })
    create(
        @Body() createTeacherDto: CreateTeacherDto,
        @Headers('x-user-id') actorId?: string,
    ) {
        return this.teacherService.create(
            createTeacherDto,
            this.parseOptionalUserId(actorId),
        );
    }

    @Get()
    @ApiOperation({ summary: 'Get paginated teachers' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'status', required: false, type: String, example: 'ACTIVE' })
    @ApiResponse({ status: 200, description: 'Teachers fetched' })
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
    ) {
        return this.teacherService.findAll(
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 10,
            status,
        );
    }

    @Get('search')
    @ApiOperation({ summary: 'Search teachers by name, email or position' })
    @ApiQuery({ name: 'query', required: true, type: String, example: 'Mentor' })
    @ApiResponse({ status: 200, description: 'Search result list' })
    search(@Query('query') query: string) {
        return this.teacherService.search(query);
    }

    @Get('me/profile')
    @UseGuards(RolesGuard)
    @Roles(Role.TEACHER)
    @ApiBearerAuth('access-token')
    @ApiHeader({
        name: 'x-user-id',
        required: false,
        description: 'Auto-populated from Bearer token by RolesGuard',
    })
    @ApiOperation({ summary: 'Get current authenticated teacher profile' })
    @ApiResponse({ status: 200, description: 'Teacher profile returned' })
    getMyProfile(@Headers('x-user-id') teacherId: string) {
        return this.teacherService.getProfile(this.parseRequiredUserId(teacherId));
    }

    @Get('me/coin/history')
    @UseGuards(RolesGuard)
    @Roles(Role.TEACHER)
    @ApiBearerAuth('access-token')
    @ApiHeader({
        name: 'x-user-id',
        required: false,
        description: 'Auto-populated from Bearer token by RolesGuard',
    })
    @ApiOperation({ summary: 'Get current authenticated teacher coin history' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    @ApiResponse({ status: 200, description: 'Teacher coin history returned' })
    getMyCoinHistory(
        @Headers('x-user-id') teacherId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.teacherService.getCoinHistory(
            this.parseRequiredUserId(teacherId),
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 20,
        );
    }

    @Get(':id/profile')
    @ApiOperation({ summary: 'Get teacher profile details with groups and coin summary' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Teacher profile returned' })
    @ApiResponse({ status: 404, description: 'Teacher not found' })
    getProfile(@Param('id', ParseIntPipe) id: number) {
        return this.teacherService.getProfile(id);
    }

    @Get(':id/coin/history')
    @ApiOperation({ summary: 'Get paginated teacher coin transaction history' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    @ApiResponse({ status: 200, description: 'Teacher coin history returned' })
    getCoinHistory(
        @Param('id', ParseIntPipe) id: number,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.teacherService.getCoinHistory(
            id,
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 20,
        );
    }

    @Post(':id/coin/adjust')
    @ApiOperation({ summary: 'Increment or decrement teacher coin balance' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiBody({ type: AdjustTeacherCoinDto })
    @ApiResponse({ status: 201, description: 'Teacher coin balance adjusted' })
    adjustCoin(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AdjustTeacherCoinDto,
        @Headers('x-user-id') actorId?: string,
    ) {
        return this.teacherService.adjustCoin(
            id,
            dto,
            this.parseOptionalUserId(actorId),
        );
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get teacher by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Teacher details' })
    @ApiResponse({ status: 404, description: 'Teacher not found' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.teacherService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update teacher by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiBody({ type: UpdateTeacherDto })
    @ApiResponse({ status: 200, description: 'Teacher updated' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTeacherDto: UpdateTeacherDto,
    ) {
        return this.teacherService.update(id, updateTeacherDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete teacher by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Teacher removed' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.teacherService.remove(id);
    }

    private parseOptionalUserId(rawId?: string): number | null {
        if (!rawId) {
            return null;
        }

        const parsed = Number(rawId);
        if (!Number.isInteger(parsed) || parsed < 1) {
            throw new BadRequestException(
                'x-user-id header must be a positive integer',
            );
        }

        return parsed;
    }

    private parseRequiredUserId(rawId?: string): number {
        const parsed = this.parseOptionalUserId(rawId);
        if (!parsed) {
            throw new BadRequestException('x-user-id header is required');
        }

        return parsed;
    }
}
