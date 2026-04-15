import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CourseModule } from './modules/course/course.module';
import { StudentModule } from './modules/student/student.module';
import { GroupModule } from './modules/group/group.module';
import { RoomModule } from './modules/room/room.module';
import { TeacherModule } from './modules/teacher/teacher.module';
import { ErpModule } from './modules/erp/erp.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationModule } from './common/notifications/notification.module';
@Module({
    imports: [
        PrismaModule,
        NotificationModule,
        AuthModule,
        CourseModule,
        StudentModule,
        GroupModule,
        RoomModule,
        TeacherModule,
        ErpModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
}
