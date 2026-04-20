-- CreateEnum
CREATE TYPE "HomeworkCoinTrack" AS ENUM ('STANDARD', 'BOOTCAMP');

-- AlterTable
ALTER TABLE "HomeworkResult" ADD COLUMN     "teacherCoinAward" INTEGER;

-- CreateTable
CREATE TABLE "HomeworkCoinPolicy" (
    "id" SERIAL NOT NULL,
    "track" "HomeworkCoinTrack" NOT NULL,
    "coin60To89" INTEGER NOT NULL DEFAULT 5,
    "coin90To100" INTEGER NOT NULL DEFAULT 7,
    "updatedBy" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkCoinPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkCoinPolicy_track_key" ON "HomeworkCoinPolicy"("track");
