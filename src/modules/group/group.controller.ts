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
import { GroupService } from './group.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddStudentToGroupDto } from './dto/add-student.dto';

@Controller('groups')
@ApiTags('groups')
export class GroupController {
    constructor(private readonly groupService: GroupService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create group' })
    @ApiBody({ type: CreateGroupDto })
    @ApiResponse({ status: 201, description: 'Group created' })
    @ApiResponse({ status: 400, description: 'Validation or relation error' })
    create(@Body() createGroupDto: CreateGroupDto) {
        return this.groupService.create(createGroupDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get paginated groups' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'status', required: false, type: String, example: 'ACTIVE' })
    @ApiResponse({ status: 200, description: 'Groups fetched' })
    findAll(
        @Query('page', new ParseIntPipe({ optional: true })) page?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
        @Query('status') status?: string,
    ) {
        return this.groupService.findAll(page, limit, status);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get group by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Group details' })
    @ApiResponse({ status: 404, description: 'Group not found' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.groupService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update group by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiBody({ type: UpdateGroupDto })
    @ApiResponse({ status: 200, description: 'Group updated' })
    @ApiResponse({ status: 404, description: 'Group not found' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateGroupDto: UpdateGroupDto,
    ) {
        return this.groupService.update(id, updateGroupDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Archive group by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Group archived' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.groupService.remove(id);
    }

    @Post(':id/students')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Add student to group' })
    @ApiParam({ name: 'id', type: Number, example: 1, description: 'Group ID' })
    @ApiBody({ type: AddStudentToGroupDto })
    @ApiResponse({ status: 201, description: 'Student added to group' })
    @ApiResponse({ status: 409, description: 'Student already in group' })
    addStudent(
        @Param('id', ParseIntPipe) id: number,
        @Body() addStudentDto: AddStudentToGroupDto,
    ) {
        return this.groupService.addStudent(id, addStudentDto);
    }

    @Delete(':id/students/:studentId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove student from group' })
    @ApiParam({ name: 'id', type: Number, example: 1, description: 'Group ID' })
    @ApiParam({ name: 'studentId', type: Number, example: 10 })
    @ApiResponse({ status: 200, description: 'Student removed from group' })
    @ApiResponse({ status: 404, description: 'Membership not found' })
    removeStudent(
        @Param('id', ParseIntPipe) id: number,
        @Param('studentId', ParseIntPipe) studentId: number,
    ) {
        return this.groupService.removeStudent(id, studentId);
    }
}
