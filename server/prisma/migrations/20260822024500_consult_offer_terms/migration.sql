-- AlterTable
ALTER TABLE "BriefInquiry" ADD COLUMN "durationMinutes" INTEGER;
ALTER TABLE "BriefInquiry" ADD COLUMN "quotedFee" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "briefInquiryId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "offerDescription" TEXT;
ALTER TABLE "Booking" ADD COLUMN "agreedDurationMinutes" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_briefInquiryId_key" ON "Booking"("briefInquiryId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_briefInquiryId_fkey" FOREIGN KEY ("briefInquiryId") REFERENCES "BriefInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
