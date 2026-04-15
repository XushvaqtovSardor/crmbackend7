const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { CoinTransactionType, PrismaClient, CourseLevel, HomeworkStatus, HomeworkStatusStudent, Role, Status, UserStatus, WeekDays, } = require('@prisma/client');
const connectionString = process.env.DATABASE_URL ||
    'postgresql://sardor:postgres@localhost:5432/imtihon5?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['warn', 'error'] });
async function resetDatabase() {
    await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
            "TeacherCoinTransaction",
      "Rating",
      "HomeworkResult",
      "HomeworkResponse",
      "LessonVideo",
      "Homework",
      "Attendance",
      "Lesson",
      "StudentGroup",
      "Group",
      "Room",
      "Course",
      "Student",
      "Teacher",
      "User"
    RESTART IDENTITY CASCADE;
  `);
}
async function main() {
    const [adminPassword, teacherPassword, studentPassword] = await Promise.all([
        bcrypt.hash('superadmin', 10),
        bcrypt.hash('teacher', 10),
        bcrypt.hash('student', 10),
    ]);
    await resetDatabase();
    const superAdmin = await prisma.user.create({
        data: {
            fullName: 'Super Admin',
            email: 'superadmin@gmail.com',
            password: adminPassword,
            position: 'Platform Owner',
            hire_date: new Date('2024-01-10T09:00:00.000Z'),
            role: Role.SUPERADMIN,
            status: UserStatus.ACTIVE,
            address: 'Tashkent',
        },
    });
    const admin = await prisma.user.create({
        data: {
            fullName: 'Admin User',
            email: 'admin@gmail.com',
            password: adminPassword,
            position: 'Branch Admin',
            hire_date: new Date('2024-02-01T09:00:00.000Z'),
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
            address: 'Tashkent',
        },
    });
    const teacher = await prisma.teacher.create({
        data: {
            fullName: "O'qituvchi",
            email: 'teacher@gmail.com',
            phone: '+998901112233',
            birth_date: new Date('1996-02-10T00:00:00.000Z'),
            password: teacherPassword,
            position: 'Frontend Mentor',
            experience: 5,
            coinBalance: 80,
            createdBy: admin.id,
            status: UserStatus.ACTIVE,
        },
    });
    const assistantTeacher = await prisma.teacher.create({
        data: {
            fullName: 'John Brown',
            email: 'john@gmail.com',
            phone: '+998902223344',
            birth_date: new Date('1993-08-21T00:00:00.000Z'),
            password: teacherPassword,
            position: 'Backend Mentor',
            experience: 4,
            coinBalance: 30,
            createdBy: admin.id,
            status: UserStatus.ACTIVE,
        },
    });
    const student = await prisma.student.create({
        data: {
            fullName: 'Talaba',
            email: 'student@gmail.com',
            password: studentPassword,
            birth_date: new Date('2006-05-12T00:00:00.000Z'),
            status: UserStatus.ACTIVE,
        },
    });
    const secondStudent = await prisma.student.create({
        data: {
            fullName: 'Munira',
            email: 'munira@gmail.com',
            password: studentPassword,
            birth_date: new Date('2005-11-08T00:00:00.000Z'),
            status: UserStatus.ACTIVE,
        },
    });
    const frontendCourse = await prisma.course.create({
        data: {
            name: 'Frontend React',
            durationMonth: 6,
            durationLesson: 48,
            level: CourseLevel.INTERMEDIATE,
            price: 1200000,
            description: 'React, routing, state management va real loyiha amaliyoti',
            status: Status.ACTIVE,
        },
    });
    const backendCourse = await prisma.course.create({
        data: {
            name: 'Backend Node.js',
            durationMonth: 5,
            durationLesson: 40,
            level: CourseLevel.INTERMEDIATE,
            price: 1350000,
            description: 'NestJS, Prisma, PostgreSQL va REST API ishlanmalari',
            status: Status.ACTIVE,
        },
    });
    const roomA = await prisma.room.create({
        data: {
            name: 'Netflex',
            capacity: 18,
            status: Status.ACTIVE,
        },
    });
    const roomB = await prisma.room.create({
        data: {
            name: 'Osmondagi bollar',
            capacity: 16,
            status: Status.ACTIVE,
        },
    });
    const frontendGroup = await prisma.group.create({
        data: {
            teacherId: teacher.id,
            userId: admin.id,
            roomId: roomA.id,
            courseId: frontendCourse.id,
            name: 'FullStack N25',
            startDate: new Date('2026-03-01T00:00:00.000Z'),
            startTime: '6:30',
            weekDays: [WeekDays.MONDAY, WeekDays.TUESDAY, WeekDays.WEDNESDAY, WeekDays.THURSDAY, WeekDays.FRIDAY],
            status: Status.ACTIVE,
        },
    });
    const backendGroup = await prisma.group.create({
        data: {
            teacherId: assistantTeacher.id,
            userId: admin.id,
            roomId: roomB.id,
            courseId: backendCourse.id,
            name: 'Backend N12',
            startDate: new Date('2026-03-03T00:00:00.000Z'),
            startTime: '20:00',
            weekDays: [WeekDays.TUESDAY, WeekDays.THURSDAY, WeekDays.SATURDAY],
            status: Status.ACTIVE,
        },
    });
    await prisma.studentGroup.createMany({
        data: [
            {
                userId: admin.id,
                groupId: frontendGroup.id,
                studentId: student.id,
                status: Status.ACTIVE,
            },
            {
                userId: admin.id,
                groupId: frontendGroup.id,
                studentId: secondStudent.id,
                status: Status.ACTIVE,
            },
        ],
    });
    await prisma.teacherCoinTransaction.createMany({
        data: [
            {
                teacherId: teacher.id,
                amount: 100,
                balanceAfter: 100,
                type: CoinTransactionType.CREDIT,
                reason: 'Boshlangich bonus',
                createdBy: admin.id,
            },
            {
                teacherId: teacher.id,
                amount: 20,
                balanceAfter: 80,
                type: CoinTransactionType.DEBIT,
                reason: 'Sarflangan coin',
                createdBy: admin.id,
            },
            {
                teacherId: assistantTeacher.id,
                amount: 30,
                balanceAfter: 30,
                type: CoinTransactionType.CREDIT,
                reason: "Yangi o'qituvchi bonusi",
                createdBy: admin.id,
            },
        ],
    });
    const introLesson = await prisma.lesson.create({
        data: {
            groupId: frontendGroup.id,
            teacherId: teacher.id,
            title: 'React',
        },
    });
    const hooksLesson = await prisma.lesson.create({
        data: {
            groupId: frontendGroup.id,
            teacherId: teacher.id,
            title: 'Hooks',
        },
    });
    await prisma.lesson.create({
        data: {
            groupId: backendGroup.id,
            teacherId: assistantTeacher.id,
            title: 'NestJS modul arxitekturasi',
        },
    });
    await prisma.lessonVideo.create({
        data: {
            lessonId: introLesson.id,
            teacherId: teacher.id,
            file: 'https://cdn.example.com/videos/react-asoslari.mp4',
        },
    });
    const upcomingHomework = await prisma.homework.create({
        data: {
            lessonId: introLesson.id,
            teacherId: teacher.id,
            title: 'React komponent sahifasi',
            file: 'https://cdn./homeworks/react-komponent.pdf',
            durationTime: 24,
            deadlineAt: new Date('2026-03-25T18:00:00.000Z'),
            maxAttempts: 2,
            allowLateSubmission: true,
        },
    });
    const reviewedHomework = await prisma.homework.create({
        data: {
            lessonId: hooksLesson.id,
            teacherId: teacher.id,
            title: 'useState va useEffect amaliyoti',
            file: 'https:/4.pdf',
            durationTime: 16,
            deadlineAt: new Date('2026-03-10T18:00:00.000Z'),
            maxAttempts: 1,
            allowLateSubmission: false,
        },
    });
    await prisma.homeworkResponse.create({
        data: {
            homeworkId: upcomingHomework.id,
            studentId: student.id,
            title: 'Landing page komponentlari',
            file: 'https://cdn.example.com/submissions/landing-page.zip',
            status: HomeworkStatusStudent.COMPLETED,
            attemptNo: 1,
        },
    });
    const reviewedResponse = await prisma.homeworkResponse.create({
        data: {
            homeworkId: reviewedHomework.id,
            studentId: student.id,
            title: 'Hooks bilan todo app',
            file: 'https://cdn.example.com/submissions/todo-hooks.zip',
            status: HomeworkStatusStudent.COMPLETED,
            attemptNo: 1,
            feedback: 'State va effectlar toza ishlatilgan.',
            reviewedAt: new Date('2026-03-12T10:30:00.000Z'),
        },
    });
    await prisma.homeworkResult.create({
        data: {
            homeworkId: reviewedHomework.id,
            studentId: student.id,
            teacherId: teacher.id,
            title: reviewedResponse.title,
            file: reviewedResponse.file,
            score: 92,
            status: HomeworkStatus.APPROVED,
        },
    });
    await prisma.rating.create({
        data: {
            teacherId: teacher.id,
            lessonId: introLesson.id,
            score: 5,
        },
    });
    console.log('Seed completed successfully.');
    console.log('Demo users:');
    console.log('  superadmin@gmail.com / admin123');
    console.log('  admin@gmail.com / admin123');
    console.log('  teacher@gmail.com / teacher123');
    console.log('  student@gmail.com / student123');
    console.log(`Teacher header id: ${teacher.id}`);
    console.log(`Student header id: ${student.id}`);
    console.log(`Superadmin header id: ${superAdmin.id}`);
    console.log(`Admin header id: ${admin.id}`);
}
main()
    .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
