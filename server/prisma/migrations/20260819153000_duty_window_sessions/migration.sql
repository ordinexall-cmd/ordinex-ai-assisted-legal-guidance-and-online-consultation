-- Duty windows can hold many bookings. Session times live on Booking.
DROP INDEX IF EXISTS "Booking_availabilityId_key";

ALTER TABLE "Booking" ADD COLUMN "preferredStartTime" TEXT;
ALTER TABLE "Booking" ADD COLUMN "sessionStartTime" TEXT;
ALTER TABLE "Booking" ADD COLUMN "sessionEndTime" TEXT;

CREATE INDEX "Booking_lawyerId_status_idx" ON "Booking"("lawyerId", "status");
CREATE INDEX "Booking_availabilityId_idx" ON "Booking"("availabilityId");
