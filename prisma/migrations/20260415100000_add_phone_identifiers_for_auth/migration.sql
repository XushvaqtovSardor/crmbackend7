ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "Student" ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "Student_phone_key" ON "Student"("phone");
CREATE UNIQUE INDEX "Teacher_phone_key" ON "Teacher"("phone");
