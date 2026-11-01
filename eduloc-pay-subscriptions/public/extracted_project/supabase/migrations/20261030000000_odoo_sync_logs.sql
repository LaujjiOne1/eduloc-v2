-- Journal de synchronisation site -> Odoo (cahier "odoo integration.md", §6.2).
-- Le formulaire continue d'écrire dans support_requests sans dépendre d'Odoo : une ligne PENDING
-- est créée par déclencheur, dans la même transaction que la demande, puis traitée par la
-- fonction Edge `odoo-sync`.

CREATE TABLE public.odoo_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_request_id uuid NOT NULL UNIQUE REFERENCES public.support_requests(id) ON DELETE RESTRICT,
  external_reference text NOT NULL UNIQUE,
  odoo_lead_id integer,
  odoo_partner_id integer,
  sync_status text NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  -- Prochaine tentative automatique ; NULL = plus de reprise automatique (action humaine requise).
  next_attempt_at timestamptz DEFAULT now(),
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sync_status_ok CHECK (sync_status IN ('PENDING', 'SUCCESS', 'FAILED'))
);

CREATE INDEX odoo_sync_logs_due_idx ON public.odoo_sync_logs (next_attempt_at)
  WHERE sync_status IN ('PENDING', 'FAILED');

-- Aucune politique : seul service_role (RLS contourné) lit et écrit ce journal.
ALTER TABLE public.odoo_sync_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.odoo_sync_logs FROM anon, authenticated;
GRANT ALL ON public.odoo_sync_logs TO service_role;

CREATE FUNCTION public.enqueue_odoo_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.odoo_sync_logs (support_request_id, external_reference)
  VALUES (NEW.id, 'EDULOC-SUPPORT-' || NEW.id::text)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_odoo_sync() FROM PUBLIC;

CREATE TRIGGER support_requests_enqueue_odoo_sync
AFTER INSERT ON public.support_requests
FOR EACH ROW EXECUTE FUNCTION public.enqueue_odoo_sync();

-- Les demandes déjà présentes ne sont PAS envoyées automatiquement (elles peuvent contenir des
-- essais). Pour les transmettre à Odoo après vérification, exécuter manuellement :
--
--   INSERT INTO public.odoo_sync_logs (support_request_id, external_reference)
--   SELECT id, 'EDULOC-SUPPORT-' || id::text FROM public.support_requests
--   ON CONFLICT DO NOTHING;
