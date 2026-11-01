-- Annule 20261031120000_oauth_accounts.
-- ATTENTION : remettre NOT NULL sur users.password échoue tant qu'un compte créé par connexion sociale (password NULL)
-- existe. Donner d'abord un mot de passe à ces comptes (ou les supprimer), par exemple :
--   SELECT id, email FROM users WHERE password IS NULL;
DROP TABLE IF EXISTS "oauth_accounts";
DROP TYPE IF EXISTS "OAuthProvider";
ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL;
