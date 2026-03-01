-- AlterEnum: Add PENDING to IntegrityStatus
ALTER TYPE "IntegrityStatus" ADD VALUE IF NOT EXISTS 'PENDING';
