import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    ParseIntPipe,
} from '@nestjs/common';
import {
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { TeacherService } from './teacher.service';
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
    create(@Body() createTeacherDto: CreateTeacherDto) {
        return this.teacherService.create(createTeacherDto);
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
}
