-- CreateEnum
CREATE TYPE "CoinTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "coinBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "TeacherCoinTransaction" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "type" "CoinTransactionType" NOT NULL,
    "reason" TEXT,
    "createdBy" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherCoinTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherCoinTransaction_teacherId_created_at_idx" ON "TeacherCoinTransaction"("teacherId", "created_at");

-- CreateIndex
CREATE INDEX "TeacherCoinTransaction_createdBy_idx" ON "TeacherCoinTransaction"("createdBy");

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCoinTransaction" ADD CONSTRAINT "TeacherCoinTransaction_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCoinTransaction" ADD CONSTRAINT "TeacherCoinTransaction_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
