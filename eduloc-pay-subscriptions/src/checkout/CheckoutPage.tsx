import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { Logo } from '@/components/site/Logo';
import { CheckoutError, type PaymentState, type SessionInfo, checkoutApi, formatAmount, loadStripe, readTicket, returnToApp } from './api';

type Method = 'card' | 'mobile';
type Phase =
  | { kind: 'loading' }
  | { kind: 'fatal'; message: string }
  | { kind: 'ready'; session: SessionInfo }
  | { kind: 'done'; session: SessionInfo; state: PaymentState };

const FINAL: PaymentState[] = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Page de paiement EduLoc, ouverte depuis l'application avec un ticket signé (#ticket=…). Le montant est FIGÉ par EduLoc : aucun
 * champ ne permet de le changer. La carte est saisie dans les champs hébergés par Stripe (jamais dans cette page) ; pour Mobile
 * Money, la confirmation se fait sur le téléphone, dans le canal de l'opérateur : on ne demande jamais de code secret.
 */
export function CheckoutPage() {
  const ticket = useRef(readTicket()).current;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [method, setMethod] = useState<Method>('card');

  useEffect(() => {
    if (!ticket) {
      setPhase({ kind: 'fatal', message: 'Lien de paiement incomplet. Retournez dans l’application et relancez le paiement.' });
      return;
    }
    checkoutApi
      .session(ticket)
      .then((session) => {
        if (FINAL.includes(session.state)) setPhase({ kind: 'done', session, state: session.state });
        else {
          setPhase({ kind: 'ready', session });
          setMethod(session.methods.visa ? 'card' : 'mobile');
        }
      })
      .catch((error: unknown) => setPhase({ kind: 'fatal', message: error instanceof Error ? error.message : 'Erreur inconnue.' }));
  }, [ticket]);

  const finish = useCallback((session: SessionInfo, state: PaymentState) => setPhase({ kind: 'done', session, state }), []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#14162B]">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Logo size="sm" />
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E9C82]">
            <Lock className="h-3.5 w-3.5" /> Paiement sécurisé
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {phase.kind === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#585B78]">
            <Loader2 className="h-4 w-4 animate-spin" /> Vérification du ticket…
          </div>
        )}

        {phase.kind === 'fatal' && (
          <div className="rounded-2xl border border-[#AC4A40]/30 bg-[#F6E9E6] p-5 text-sm text-[#AC4A40]" role="alert">
            <p className="mb-1 flex items-center gap-2 font-bold"><XCircle className="h-4 w-4" /> Paiement impossible</p>
            <p>{phase.message}</p>
          </div>
        )}

        {phase.kind === 'ready' && (
          <>
            <Summary session={phase.session} />

            {phase.session.methods.visa && phase.session.methods.mobileMoney.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2" role="tablist">
                <MethodTab active={method === 'card'} onClick={() => setMethod('card')} icon={<CreditCard className="h-4 w-4" />} label="Carte bancaire" />
                <MethodTab active={method === 'mobile'} onClick={() => setMethod('mobile')} icon={<Smartphone className="h-4 w-4" />} label="Mobile Money" />
              </div>
            )}

            {!phase.session.methods.visa && phase.session.methods.mobileMoney.length === 0 ? (
              <div className="rounded-2xl border border-[#BD7E28]/30 bg-[#FAF0DE] p-4 text-sm text-[#7a5518]">
                Aucun moyen de paiement n’est disponible pour le moment. Réessayez plus tard.
              </div>
            ) : method === 'card' && phase.session.methods.visa ? (
              <CardPayment ticket={ticket!} session={phase.session} publishableKey={phase.session.methods.visa.publishableKey} onFinal={finish} />
            ) : (
              <MobileMoneyPayment ticket={ticket!} session={phase.session} operators={phase.session.methods.mobileMoney} onFinal={finish} />
            )}

            <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-[#585B78]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0E9C82]" />
              EduLoc ne voit jamais votre numéro de carte ni votre code secret Mobile Money. Le montant est fixé par EduLoc et ne peut pas être modifié ici.
            </p>
          </>
        )}

        {phase.kind === 'done' && <Result session={phase.session} state={phase.state} />}
      </main>
    </div>
  );
}

function Summary({ session }: { session: SessionInfo }) {
  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Récapitulatif">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9799AF]">À payer</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-[#332E86]">{formatAmount(session.payment.amount, session.payment.currency)}</p>
      <p className="mt-2 text-sm text-[#585B78]">{session.payment.description}</p>
    </section>
  );
}

function MethodTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
        active ? 'border-[#332E86] bg-[#ECEAF9] text-[#332E86]' : 'border-slate-200 bg-white text-[#585B78] hover:border-slate-300'
      }`}
    >
      {icon} {label}
    </button>
  );
}

/** Attend un résultat FINAL auprès du serveur (qui interroge le prestataire) ; rend « en cours » si le délai est dépassé. */
async function waitForFinal(ticket: string, attempts: number, everyMs: number, signal: { cancelled: boolean }): Promise<PaymentState> {
  let state: PaymentState = 'PENDING';
  for (let i = 0; i < attempts && !signal.cancelled; i += 1) {
    try {
      state = (await checkoutApi.status(ticket)).state;
      if (FINAL.includes(state)) return state;
    } catch {
      // coupure passagère : on continue d'attendre
    }
    await sleep(everyMs);
  }
  return state;
}

function CardPayment({ ticket, session, publishableKey, onFinal }: { ticket: string; session: SessionInfo; publishableKey: string; onFinal: (s: SessionInfo, state: PaymentState) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const stripe = useRef<any>(null);
  const elements = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const started = await checkoutApi.startCard(ticket);
        if (cancelled) return;
        if ('alreadyPaid' in started) return onFinal(session, 'SUCCEEDED');
        stripe.current = await loadStripe(publishableKey);
        // Champs hébergés par Stripe : numéro, date et code de la carte ne traversent jamais cette page.
        elements.current = stripe.current.elements({ clientSecret: started.clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#332E86', borderRadius: '12px' } } });
        elements.current.create('payment').mount(mount.current);
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof CheckoutError ? e.message : 'Impossible de préparer le paiement par carte.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket, publishableKey, session, onFinal]);

  const pay = async () => {
    if (!stripe.current || !elements.current || busy) return;
    setBusy(true);
    setError(null);
    // Visa Secure / 3-D Secure : si la banque l'exige, Stripe ouvre son propre défi. Une authentification réussie n'est PAS un
    // paiement : on attend le résultat financier relu par le serveur.
    const { error: stripeError } = await stripe.current.confirmPayment({ elements: elements.current, redirect: 'if_required' });
    if (stripeError) {
      setError(stripeError.message ?? 'Le paiement a été refusé.');
      setBusy(false);
      return;
    }
    const state = await waitForFinal(ticket, 20, 1500, { cancelled: false });
    setBusy(false);
    onFinal(session, state);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div ref={mount} aria-label="Champs de carte hébergés par Stripe" />
      {!ready && !error && (
        <div className="flex items-center gap-2 py-6 text-sm text-[#585B78]"><Loader2 className="h-4 w-4 animate-spin" /> Préparation du paiement…</div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-[#AC4A40]">{error}</p>}
      <button
        type="button"
        onClick={() => void pay()}
        disabled={!ready || busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#332E86] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#211C5E] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Vérification…</> : <>Payer {formatAmount(session.payment.amount, session.payment.currency)}</>}
      </button>
    </section>
  );
}

function MobileMoneyPayment({ ticket, session, operators, onFinal }: { ticket: string; session: SessionInfo; operators: string[]; onFinal: (s: SessionInfo, state: PaymentState) => void }) {
  const [operator, setOperator] = useState(operators[0] ?? 'mvola');
  const [phone, setPhone] = useState('');
  const [phase, setPhase] = useState<'form' | 'waiting'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signal = useRef({ cancelled: false });

  useEffect(() => {
    const current = signal.current;
    return () => {
      current.cancelled = true;
    };
  }, []);

  const wait = useCallback(async () => {
    setPhase('waiting');
    // 3 minutes au plus : un opérateur peut mettre du temps ; « toujours en cours » n'est pas un échec.
    const state = await waitForFinal(ticket, 60, 3000, signal.current);
    if (!signal.current.cancelled) onFinal(session, state);
  }, [onFinal, session, ticket]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await checkoutApi.startMobileMoney(ticket, operator, phone);
      if ('alreadyPaid' in result) return onFinal(session, 'SUCCEEDED');
      await wait();
    } catch (e) {
      setError(e instanceof CheckoutError ? e.message : 'Impossible de lancer le paiement.');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'waiting') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm" aria-live="polite">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#332E86]" />
        <p className="mt-4 text-base font-bold">Confirmez sur votre téléphone</p>
        <p className="mt-2 text-sm leading-relaxed text-[#585B78]">
          Une demande de paiement vient d’être envoyée à votre téléphone. Validez-la dans l’application ou le menu de votre opérateur.
          <strong className="block text-[#14162B]">Ne saisissez jamais votre code secret sur cette page.</strong>
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="block text-xs font-semibold text-[#585B78]" htmlFor="operator">Opérateur</label>
      <select id="operator" value={operator} onChange={(e) => setOperator(e.target.value)} className="mb-4 mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
        {operators.map((o) => <option key={o} value={o}>{o === 'mvola' ? 'MVola (Telma)' : o}</option>)}
      </select>

      <label className="block text-xs font-semibold text-[#585B78]" htmlFor="phone">Numéro Mobile Money</label>
      <input
        id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="034 12 345 67" value={phone} onChange={(e) => setPhone(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#332E86]" required
      />
      <p className="mt-2 text-xs text-[#9799AF]">Le numéro sert uniquement à envoyer la demande de paiement ; il n’est pas conservé.</p>
      {error && <p role="alert" className="mt-3 text-sm text-[#AC4A40]">{error}</p>}

      <button type="submit" disabled={busy || phone.replace(/\D/g, '').length < 9} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#332E86] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#211C5E] disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</> : <>Payer {formatAmount(session.payment.amount, session.payment.currency)}</>}
      </button>
    </form>
  );
}

function Result({ session, state }: { session: SessionInfo; state: PaymentState }) {
  const ok = state === 'SUCCEEDED';
  const pending = state === 'PENDING';
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm" aria-live="polite">
      {ok ? <CheckCircle2 className="mx-auto h-14 w-14 text-[#0E9C82]" /> : pending ? <Loader2 className="mx-auto h-12 w-12 text-[#BD7E28]" /> : <XCircle className="mx-auto h-14 w-14 text-[#AC4A40]" />}
      <h1 className="mt-4 text-xl font-bold">
        {ok ? 'Paiement reçu' : pending ? 'Paiement en cours de vérification' : state === 'CANCELLED' ? 'Paiement annulé' : 'Le paiement n’a pas abouti'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#585B78]">
        {ok
          ? `Merci ! ${formatAmount(session.payment.amount, session.payment.currency)} — ${session.payment.description}.`
          : pending
            ? 'Votre banque ou votre opérateur n’a pas encore confirmé. Vous serez prévenu dans l’application dès que ce sera fait.'
            : 'Aucun paiement n’a été confirmé. Vous pouvez réessayer depuis l’application.'}
      </p>
      <button
        type="button"
        onClick={() => returnToApp(session.payment.returnUrl, session.payment.id)}
        className="mt-6 w-full rounded-full bg-[#332E86] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#211C5E]"
      >
        Retourner à l’application
      </button>
    </section>
  );
}
