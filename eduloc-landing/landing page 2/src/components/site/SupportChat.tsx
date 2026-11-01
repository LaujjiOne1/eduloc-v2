import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Headphones, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuidedAssistant } from "./GuidedAssistant";
import { edulocConfig, hasApk, hasPhone, hasWhatsapp, telLink, whatsappLink } from "@/config/eduloc";

const TOPICS = [
  { label: "Trouver un tuteur", text: "Pour vous, votre enfant ou un proche, précisez la matière, le niveau et le format souhaité. Vous pouvez enregistrer votre besoin pour être recontacté par un conseiller." },
  { label: "Un cours ou une réservation", text: "La gestion des réservations se fait dans l’application Android edUloc. Pour demander de l’aide, indiquez le nom du tuteur ou la date du cours dans votre demande." },
  { label: "L’application Android", text: "L’application permet de rechercher un tuteur et de gérer vos cours. Le lien de téléchargement n’est pas encore renseigné sur ce site. Vous pouvez néanmoins faire une demande ici, sans compte." },
];
type Message = { role: "assistant" | "user"; text: string };
const WELCOME: Message = { role: "assistant", text: "Bonjour et bienvenue chez edUloc ! Quel est le sujet de votre demande ?" };

export const SupportChat = () => {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("eduloc:help", show);
    return () => window.removeEventListener("eduloc:help", show);
  }, []);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages, open, request]);
  const close = () => { setOpen(false); launcher.current?.focus(); };
  const answer = (text: string) => {
    const normalized = text.toLocaleLowerCase("fr");
    const topic = TOPICS.find((t) => t.label === text) ?? (/réserv|reserv|annul|paiement|cours/.test(normalized) ? TOPICS[1] : /android|application|apk|télécharg/.test(normalized) ? TOPICS[2] : /tuteur|prof|math|enfant|soutien/.test(normalized) ? TOPICS[0] : undefined);
    const reply = topic === TOPICS[2] && hasApk() ? "L’application Android permet de rechercher un tuteur et de gérer vos cours. Retrouvez le téléchargement dans la section Application du site." : topic?.text;
    setMessages((old) => [...old, { role: "user", text }, { role: "assistant", text: reply ?? "Je suis l’assistant guidé edUloc, pas un conseiller en direct. Pour une réponse personnalisée, laissez une demande au service client avec vos coordonnées." }]);
    setInput("");
  };
  return <>
    <AnimatePresence>
      {open && <motion.section initial={{ opacity: 0, y: reduce ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : 18 }} transition={{ duration: 0.2 }}
        role="dialog" aria-label="Tchat d’aide edUloc" onKeyDown={(e) => { if (e.key === "Escape") close(); }} className="support-chat fixed z-[60] flex flex-col overflow-hidden rounded-lg border bg-card shadow-soft">
        <header className="flex shrink-0 items-center gap-3 bg-primary p-4 text-primary-foreground">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-foreground/10"><Headphones className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><h2 className="text-base">Aide edUloc</h2><p className="text-xs opacity-80">Assistant guidé · Service client</p></div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Fermer le tchat" className="shrink-0 hover:bg-primary-foreground/10 hover:text-primary-foreground"><X /></Button>
        </header>
        {request ? <>
          <div className="border-b px-3 py-2"><Button variant="ghost" size="sm" onClick={() => setRequest(false)}><ArrowLeft />Retour au tchat</Button></div>
          <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"><GuidedAssistant /></div>
        </> : <>
          <div ref={scroll} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5" aria-live="polite" role="log">
            <p className="text-center text-xs text-muted-foreground">Votre espace d’assistance</p>
            {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-8 rounded-lg rounded-br-none bg-primary p-3 text-sm leading-relaxed text-primary-foreground" : "mr-5 rounded-lg rounded-tl-none bg-muted p-3 text-sm leading-relaxed"}>{m.text}</div>)}
            <div className="flex flex-col items-start gap-2">{TOPICS.map((t) => <Button key={t.label} variant="outline" size="sm" onClick={() => answer(t.label)} className="h-auto whitespace-normal py-2 text-left">{t.label}<ArrowRight /></Button>)}</div>
            <div className="border-t pt-4">
              <Button className="h-auto w-full whitespace-normal py-3" onClick={() => setRequest(true)}><Headphones />Contacter le service client<ArrowRight /></Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">Laissez une demande pour être recontacté.</p>
              {hasWhatsapp() && <Button asChild variant="outline" className="mt-2 w-full"><a href={whatsappLink()} target="_blank" rel="noreferrer">WhatsApp</a></Button>}
              {hasPhone() && <Button asChild variant="outline" className="mt-2 w-full"><a href={telLink()}>Appeler</a></Button>}
              {hasApk() && <Button asChild variant="outline" className="mt-2 w-full"><a href={edulocConfig.apkDownloadUrl} download>Télécharger l’application</a></Button>}
            </div>
          </div>
          <form className="flex shrink-0 gap-2 border-t bg-card p-3" onSubmit={(e) => { e.preventDefault(); if (input.trim()) answer(input.trim()); }}>
            <Input autoFocus aria-label="Votre question" placeholder="Écrivez votre question…" value={input} maxLength={500} onChange={(e) => setInput(e.target.value)} />
            <Button type="submit" size="icon" aria-label="Envoyer le message" disabled={!input.trim()} className="shrink-0"><Send /></Button>
          </form>
        </>}
      </motion.section>}
    </AnimatePresence>
    <Button ref={launcher} onClick={() => open ? close() : setOpen(true)} aria-expanded={open} aria-label={open ? "Réduire le tchat" : "Ouvrir le tchat d’aide"} className="fixed bottom-5 right-5 z-[60] h-14 gap-3 rounded-full px-5 shadow-soft"><MessageCircle className="!h-5 !w-5" /><span>Besoin d’aide ?</span></Button>
  </>;
};