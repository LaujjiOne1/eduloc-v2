-- Retour arrière MANUEL de la migration 20261030090000_payments.
-- À exécuter dans une transaction, APRÈS sauvegarde (pg_dump -Fc), puis à retirer du journal Prisma :
--   DELETE FROM _prisma_migrations WHERE migration_name = '20261030090000_payments';
--
-- Perte assumée : tous les paiements et leur journal d'audit. Si des paiements réels ont été encaissés, NE PAS exécuter :
-- ils servent au rapprochement avec le service de paiement (SEC-11).

BEGIN;

DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS payments;
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "PaymentStatus";

COMMIT;
