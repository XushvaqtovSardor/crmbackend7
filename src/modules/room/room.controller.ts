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
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Controller('rooms')
@ApiTags('rooms')
export class RoomController {
    constructor(private readonly roomService: RoomService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create room' })
    @ApiBody({ type: CreateRoomDto })
    @ApiResponse({ status: 201, description: 'Room created' })
    create(@Body() createRoomDto: CreateRoomDto) {
        return this.roomService.create(createRoomDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get paginated rooms' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiResponse({ status: 200, description: 'Rooms fetched' })
    findAll(
        @Query('page', new ParseIntPipe({ optional: true })) page?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        return this.roomService.findAll(page, limit);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get room by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Room details' })
    @ApiResponse({ status: 404, description: 'Room not found' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.roomService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update room by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiBody({ type: UpdateRoomDto })
    @ApiResponse({ status: 200, description: 'Room updated' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateRoomDto: UpdateRoomDto,
    ) {
        return this.roomService.update(id, updateRoomDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete or archive room by ID' })
    @ApiParam({ name: 'id', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Room removed' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.roomService.remove(id);
    }
}
