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
import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Controller('students')
@ApiTags('students')
export class StudentController {
    constructor(private readonly studentService: StudentService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create student' })
    @ApiBody({ type: CreateStudentDto })
    @ApiResponse({ status: 201, description: 'Student created' })
    @ApiResponse({ status: 400, description: 'Validation error' })
    create(@Body() createStudentDto: CreateStudentDto) {
        return this.studentService.create(createStudentDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get paginated students' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'status', required: false, type: String, example: 'ACTIVE' })
    @ApiResponse({ status: 200, description: 'Students fetched' })
    findAll(
        @Query('page', new ParseIntPipe({ optional: true })) page?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
        @Query('status') status?: string,
    ) {
        return this.studentService.findAll(page, limit, status);
    }

    @Get('search')
    @ApiOperation({ summary: 'Search students by name or email' })
    @ApiQuery({ name: 'query', required: true, type: String, example: 'Sardor' })
    @ApiResponse({ status: 200, description: 'Search result list' })
    search(@Query('query') query: string) {
        return this.studentService.search(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get student by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Student details' })
    @ApiResponse({ status: 404, description: 'Student not found' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.studentService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update student by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiBody({ type: UpdateStudentDto })
    @ApiResponse({ status: 200, description: 'Student updated' })
    @ApiResponse({ status: 404, description: 'Student not found' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateStudentDto: UpdateStudentDto,
    ) {
        return this.studentService.update(id, updateStudentDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Archive student by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Student archived' })
    @ApiResponse({ status: 404, description: 'Student not found' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.studentService.remove(id);
    }
}
