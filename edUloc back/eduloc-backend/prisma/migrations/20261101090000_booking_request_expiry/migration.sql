-- Durée de validité d'une demande en attente, choisie par le Demandeur : passé ce délai sans réponse du Tuteur, la demande expire.
-- Purement additif : la colonne est nullable (les demandes existantes n'expirent pas).

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bookings_status_expiresAt_idx" ON "bookings"("status", "expiresAt");
