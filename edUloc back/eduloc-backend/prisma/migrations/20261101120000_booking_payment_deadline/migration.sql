-- Délai de paiement après confirmation : la durée choisie par le Demandeur pour sa demande sert aussi de délai pour payer.
-- Purement additif : colonnes nullables (les réservations existantes n'ont pas d'échéance de paiement).

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "requestValidityMinutes" INTEGER,
ADD COLUMN "paymentDueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bookings_status_paymentDueAt_idx" ON "bookings"("status", "paymentDueAt");
