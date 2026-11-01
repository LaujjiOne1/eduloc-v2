import { useState } from "react";
import { ArrowRight, BadgeCheck, BookOpen, Clock, Download, GraduationCap, HeartHandshake, Mail, Menu, MessageCircle, Phone, Search, ShieldCheck, Smartphone, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Logo, CapIcon } from "@/components/site/Logo";
import { GuidedAssistant } from "@/components/site/GuidedAssistant";
import { edulocConfig, hasApk, hasDirectChannel, hasEmail, hasPhone, hasWhatsapp, mailLink, telLink, whatsappLink } from "@/config/eduloc";
import { SupportChat } from "@/components/site/SupportChat";
import { MotionThreads } from "@/components/site/MotionThreads";
import heroImage from "@/assets/tutoring-hero.jpg";
import schoolImage from "@/assets/school-support.jpg";
import adultImage from "@/assets/adult-learning.jpg";
import { ScrollReveal } from "@/components/site/ScrollReveal";

const openHelp = () => window.dispatchEvent(new Event("eduloc:help"));

const NAV = [
  { href: "#fonctionnement", label: "Comment ça marche" },
  { href: "#services", label: "Services" },
  { href: "#application", label: "L'application" },
  { href: "#faq", label: "FAQ" },
];

const Header = () => {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <a href="#top" aria-label="edUloc, accueil"><Logo /></a>
        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => <a key={n.href} href={n.href} className="text-sm font-medium text-muted-foreground transition hover:text-foreground">{n.label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <Button onClick={openHelp} className="hidden rounded-full sm:inline-flex"><MessageCircle />Demander de l'aide</Button>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {open && (
        <nav className="border-t bg-background md:hidden">
          <div className="container flex flex-col py-3">
            {NAV.map((n) => <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="py-2.5 font-medium">{n.label}</a>)}
            <Button className="mt-2 rounded-full" onClick={() => { setOpen(false); openHelp(); }}><MessageCircle />Demander de l'aide</Button>
          </div>
        </nav>
      )}
    </header>
  );
};

const DownloadButton = ({ variant = "outline" as "outline" | "default" }) =>
  hasApk() ? (
    <Button asChild size="lg" variant={variant} className="rounded-full">
      <a href={edulocConfig.apkDownloadUrl} download><Download className="mr-2 h-4 w-4" />Télécharger edUloc{edulocConfig.apkVersion && ` · v${edulocConfig.apkVersion}`}</a>
    </Button>
  ) : (
    <Button size="lg" variant={variant} className="rounded-full" disabled>
      <Smartphone className="mr-2 h-4 w-4" />Application Android bientôt disponible
    </Button>
  );

const Hero = () => (
  <section id="top" className="relative isolate overflow-hidden bg-primary-dark text-primary-foreground">
    <img src={heroImage} width={1536} height={1024} fetchPriority="high" alt="Une tutrice accompagne un élève dans ses exercices de mathématiques" className="hero-photo absolute inset-0 -z-20 h-full w-full object-cover object-right" />
    <div className="hero-shade absolute inset-0 -z-10" />
    <div className="container relative py-14 md:py-20">
      <div className="max-w-xl motion-reveal">
        <span className="inline-flex items-center gap-2 text-sm font-medium"><BookOpen className="h-4 w-4" />Soutien scolaire · Cours particuliers</span>
        <h1 className="mt-5 text-5xl leading-[1.05] sm:text-6xl lg:text-7xl"><span>edU</span><span className="text-violet">loc</span></h1>
        <p className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
          Le bon accompagnement,<br />au bon endroit.
        </p>
        <p className="mt-5 max-w-md text-base leading-relaxed text-primary-foreground/85">
          Décrivez votre besoin, un conseiller edUloc trouve le tuteur qui correspond à votre enfant, à vous ou à un proche. Sans compte, sans installation.
        </p>
        <div className="mt-8 flex flex-col items-start gap-3">
          <Button size="lg" onClick={openHelp} className="h-auto max-w-full whitespace-normal rounded-full bg-emerald py-3 text-left hover:bg-emerald/90"><MessageCircle />Trouver un tuteur avec un conseiller<ArrowRight className="h-4 w-4 shrink-0" /></Button>
          <a href="#application" className="inline-flex items-center gap-2 py-2 text-sm font-medium underline underline-offset-4">Je préfère l'application<ArrowRight className="h-4 w-4" /></a>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-primary-foreground/85">
          <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald" />Tuteurs vérifiés</li>
          <li className="flex items-center gap-1.5"><HeartHandshake className="h-4 w-4 text-emerald" />Un conseiller dédié</li>
          <li className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-emerald" />Du primaire au supérieur</li>
        </ul>
      </div>
    </div>
  </section>
);

const Section = ({ id, eyebrow, title, intro, children, className = "" }: { id: string; eyebrow: string; title: string; intro?: string; children: React.ReactNode; className?: string }) => (
  <section id={id} className={`scroll-mt-16 py-20 ${className}`}>
    <div className="container">
      <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-3xl sm:text-4xl">{title}</h2>
        {intro && <p className="mt-4 text-muted-foreground">{intro}</p>}
      </ScrollReveal>
      {children}
    </div>
  </section>
);

const HowItWorks = () => (
  <Section id="fonctionnement" eyebrow="Comment ça marche" title="Deux façons d'obtenir un professeur" intro="Choisissez le parcours qui vous convient. Dans les deux cas, ce sont les mêmes tuteurs edUloc.">
    <div className="grid gap-6 md:grid-cols-2">
      <PathCard tone="primary" icon={HeartHandshake} badge="Le plus simple" title="Avec un conseiller"
        steps={["Décrivez votre besoin en quelques clics ou par message", "Un conseiller recherche les tuteurs disponibles pour vous", "Il vous propose un professeur et organise le premier cours"]}
        cta={<Button asChild className="rounded-full"><a href="#aide">Décrire mon besoin<ArrowRight className="ml-2 h-4 w-4" /></a></Button>} />
      <PathCard delay={0.12} tone="violet" icon={Smartphone} badge="En autonomie" title="Avec l'application"
        steps={["Téléchargez edUloc sur votre téléphone Android", "Recherchez un tuteur selon la matière et le niveau", "Réservez et suivez vos cours depuis l'application"]}
        cta={<DownloadButton />} />
    </div>
  </Section>
);

const PathCard = ({ tone, icon: Icon, badge, title, steps, cta, delay = 0 }: { tone: "primary" | "violet"; icon: typeof Users; badge: string; title: string; steps: string[]; cta: React.ReactNode; delay?: number }) => (
  <ScrollReveal delay={delay} className={`flex flex-col rounded-2xl border p-7 ${tone === "primary" ? "bg-card" : "bg-violet-tint"}`}>
    <div className="flex items-center justify-between">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary-tint text-primary"><Icon className="h-6 w-6" /></span>
      <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary">{badge}</span>
    </div>
    <h3 className="mt-5 text-2xl">{title}</h3>
    <ol className="mt-5 flex-1 space-y-4">
      {steps.map((s, i) => (
        <li key={s} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">{i + 1}</span><span className="pt-0.5">{s}</span></li>
      ))}
    </ol>
    <div className="mt-7">{cta}</div>
  </ScrollReveal>
);

const SERVICES = [
  { icon: BookOpen, image: schoolImage, title: "Soutien scolaire", text: "Cours réguliers pour consolider les bases et reprendre confiance." },
  { icon: Search, image: heroImage, title: "Aide aux devoirs", text: "Un accompagnement au quotidien pour gagner en méthode et en autonomie." },
  { icon: GraduationCap, image: schoolImage, title: "Préparation aux examens", text: "Brevet, bac, concours : des révisions ciblées avant les échéances." },
  { icon: Users, image: adultImage, title: "Cours pour adultes", text: "Langues, remise à niveau ou reconversion, à votre rythme." },
];

const Services = () => (
  <Section id="services" eyebrow="Services" title="Un accompagnement pour chaque besoin" className="bg-card">
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {SERVICES.map((s, index) => (
        <ScrollReveal key={s.title} delay={index * 0.09} className="group overflow-hidden rounded-lg border bg-background transition-shadow duration-300 hover:shadow-soft">
          <img src={s.image} alt={s.title} width={1024} height={768} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-105" />
          <div className="p-5">
          <s.icon className="h-7 w-7 text-primary" />
          <h3 className="mt-4 text-lg">{s.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
          </div>
        </ScrollReveal>
      ))}
    </div>
    <p className="mt-8 text-center text-sm text-muted-foreground">À domicile ou en ligne · Du primaire au supérieur</p>
  </Section>
);

const Help = () => (
  <Section id="aide" eyebrow="Assistance" title="Parlez-nous de votre besoin" intro="Pas besoin d'installer l'application ni de créer un compte. Répondez à quelques questions, on s'occupe du reste.">
    <ScrollReveal className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <GuidedAssistant />
      <aside className="space-y-4">
        <div className="rounded-2xl border bg-card p-6">
          <h3 className="text-lg">Joindre un conseiller</h3>
          {hasDirectChannel() ? (
            <div className="mt-4 space-y-3">
              {hasWhatsapp() && <Channel href={whatsappLink("Bonjour, je souhaite de l'aide pour trouver un tuteur.")} icon={MessageCircle} label="WhatsApp" sub="Canal privilégié" external />}
              {hasPhone() && <Channel href={telLink()} icon={Phone} label="Appeler" sub={edulocConfig.phone} />}
              {hasEmail() && <Channel href={mailLink()} icon={Mail} label="E-mail" sub={edulocConfig.email} />}
              {edulocConfig.hours && <p className="flex items-center gap-2 pt-1 text-sm text-muted-foreground"><Clock className="h-4 w-4" />{edulocConfig.hours}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nos lignes WhatsApp et téléphone seront bientôt disponibles. En attendant, utilisez l'assistant : votre demande est enregistrée et un conseiller vous recontacte.</p>
          )}
        </div>
        <div className="rounded-2xl bg-primary p-6 text-primary-foreground">
          <CapIcon className="h-8 w-8 opacity-80" />
          <p className="mt-3 font-display text-lg font-bold">Ce qui se passe ensuite</p>
          <p className="mt-2 text-sm opacity-85">Un conseiller étudie votre demande, recherche les tuteurs adaptés et leurs disponibilités, puis vous fait une proposition.</p>
        </div>
      </aside>
    </ScrollReveal>
  </Section>
);

const Channel = ({ href, icon: Icon, label, sub, external }: { href: string; icon: typeof Phone; label: string; sub: string; external?: boolean }) => (
  <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="flex items-center gap-3 rounded-xl border p-3 transition hover:border-primary hover:bg-primary-tint">
    <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-tint text-emerald"><Icon className="h-5 w-5" /></span>
    <span><span className="block font-semibold">{label}</span><span className="text-sm text-muted-foreground">{sub}</span></span>
  </a>
);

const AppSection = () => (
  <section id="application" className="scroll-mt-16 py-20">
    <div className="container">
      <ScrollReveal className="relative overflow-hidden rounded-3xl bg-primary-dark p-8 text-primary-foreground sm:p-14">
        <MotionThreads />
        <div className="relative max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet">Application Android</p>
          <h2 className="mt-2 text-3xl sm:text-4xl">Gérez vos cours en toute autonomie</h2>
          <p className="mt-4 opacity-85">Recherchez des tuteurs, consultez leurs disponibilités, réservez et suivez vos cours depuis votre téléphone.</p>
          <div className="mt-8"><DownloadButton variant="default" /></div>
          {hasApk() && <p className="mt-3 text-xs opacity-70">Fichier APK pour Android. Autorisez l'installation depuis votre navigateur si demandé.</p>}
        </div>
      </ScrollReveal>
    </div>
  </section>
);

const FAQS = [
  { q: "Dois-je installer l'application pour obtenir un tuteur ?", a: "Non. Vous pouvez décrire votre besoin sur ce site : un conseiller s'occupe de la recherche pour vous." },
  { q: "Combien de temps pour être recontacté ?", a: "Un conseiller traite votre demande dès que possible et vous recontacte par le moyen que vous avez choisi." },
  { q: "Les cours ont-ils lieu à domicile ou en ligne ?", a: "Les deux sont possibles : indiquez votre préférence dans l'assistant." },
  { q: "L'application est-elle disponible sur iPhone ?", a: "Pour l'instant, edUloc est disponible sur Android. Sur iPhone, passez par un conseiller." },
];

const Faq = () => (
  <Section id="faq" eyebrow="FAQ" title="Questions fréquentes" className="bg-card">
    <ScrollReveal className="mx-auto max-w-2xl"><Accordion type="single" collapsible>
      {FAQS.map((f) => (
        <AccordionItem key={f.q} value={f.q}><AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{f.a}</AccordionContent></AccordionItem>
      ))}
    </Accordion></ScrollReveal>
  </Section>
);

const Footer = () => (
  <footer className="bg-foreground py-12 text-primary-foreground">
    <div className="container flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
      <div><Logo inverted /><p className="mt-3 text-sm opacity-70">Le bon accompagnement, au bon endroit.</p></div>
      <nav className="flex flex-wrap gap-5 text-sm opacity-80">{NAV.map((n) => <a key={n.href} href={n.href} className="hover:opacity-100">{n.label}</a>)}<a href="#aide">Contact</a></nav>
      <p className="text-xs opacity-60">© {new Date().getFullYear()} edUloc</p>
    </div>
  </footer>
);

const Index = () => (
  <div className="min-h-screen">
    <Header />
    <main><Hero /><HowItWorks /><Help /><Services /><AppSection /><Faq /></main>
    <Footer />
    <SupportChat />
  </div>
);

export default Index;
