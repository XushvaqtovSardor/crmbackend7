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
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Controller('courses')
@ApiTags('courses')
export class CourseController {
    constructor(private readonly courseService: CourseService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create course' })
    @ApiBody({ type: CreateCourseDto })
    @ApiResponse({ status: 201, description: 'Course created' })
    @ApiResponse({ status: 400, description: 'Validation error' })
    create(@Body() createCourseDto: CreateCourseDto) {
        return this.courseService.create(createCourseDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get paginated courses' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiResponse({ status: 200, description: 'Courses fetched' })
    findAll(
        @Query('page', new ParseIntPipe({ optional: true })) page?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        return this.courseService.findAll(page, limit);
    }

    @Get('search')
    @ApiOperation({ summary: 'Search courses by query' })
    @ApiQuery({ name: 'query', required: true, type: String, example: 'React' })
    @ApiResponse({ status: 200, description: 'Search result list' })
    search(@Query('query') query: string) {
        return this.courseService.search(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get course by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Course details' })
    @ApiResponse({ status: 404, description: 'Course not found' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.courseService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update course by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiBody({ type: UpdateCourseDto })
    @ApiResponse({ status: 200, description: 'Course updated' })
    @ApiResponse({ status: 404, description: 'Course not found' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateCourseDto: UpdateCourseDto,
    ) {
        return this.courseService.update(id, updateCourseDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete or archive course by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Course removed' })
    @ApiResponse({ status: 404, description: 'Course not found' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.courseService.remove(id);
    }
}
