import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Animated, { interpolate, useAnimatedScrollHandler, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HouseIcon, LevelIcon, LocationIcon, SearchIcon, VerifiedBadgeIcon, VideoIcon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { PressableScale } from "@/components/motion/pressable-scale";
import { SailHeader, useRevealStyle, useSail } from "@/components/motion/sail-header";
import { SplashBrand } from "@/components/motion/splash-brand";
import { LanguageSelector } from "@/components/ui/language-selector";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/components/ui/glass-surface";
import { type HeadlineItem, RotatingHeadline } from "@/components/ui/rotating-headline";
import { Logo } from "@/components/ui/logo";
import { RecommendedTutors } from "@/components/ui/recommended-tutors";
import { usePopularCategories } from "@/hooks/use-popular-categories";
import { useRecommendedTutors } from "@/hooks/use-recommended-tutors";
import { isApprovedTutor } from "@/lib/auth-routing";
import { useAuthStore } from "@/store/auth.store";
import { useSearchWizardStore } from "@/store/search-wizard.store";
import { useTranslation } from "react-i18next";
import { ExpandingSearch } from "./search/expanding-search";

// Casting to Href keeps navigation wired per the reference workflow without
// waiting on expo-router's typed route generation, which only tracks routes
// that already exist under app/ as of the last dev-server run.
const TUTOR_INTRO_ROUTE = "/tutor-intro" as Href;
const LOGIN_ROUTE = "/login" as Href;
const SIGNUP_ROUTE = "/signup" as Href;
// 37_ModeChoice : un tuteur approuvé choisit son espace ; tout autre compte connecté va à l'espace demandeur.
const MODE_CHOICE_ROUTE = "/mode-choice" as Href;
const APPRENTI_DASHBOARD_ROUTE = "/apprenti-dashboard" as Href;

/** Hauteur du bandeau de marque une fois la voile élevée (sans la zone sûre du haut) : logo, langue et titre. */
const BAND_HEIGHT = 148;
/** La barre de recherche chevauche le bord du bandeau : moitié dedans, moitié sur le contenu. */
const SEARCH_BAR_HEIGHT = 58;
/** Le bouton « Commencer » apparaît après ce temps minimum (logo et slogan dévoilés), au plus tard au plafond ci-dessous. */
const SPLASH_MIN_MS = 1500;
const SPLASH_MAX_MS = 3500;
/** Photo du haut de l'accueil : la même que l'écran de connexion. */
const HOME_HERO = require("../../assets/images/login-hero.jpg");
/** Fond de la page (--color-paper) : la photo s'y fond en bas. */
const PAPER = "#FAF9F4";
/** De combien la carte en verre remonte sur la photo. */
const CARD_OVERLAP = 110;
/** Place réservée en bas du défilement pour la barre d'authentification fixe. */
const AUTH_BAR_SPACE = 84;

/** Teintes douces alternées des recherches populaires : de la couleur sans surcharger. */
const TREND_TINTS = [
  { bg: "bg-primary-tint", text: "text-primary" },
  { bg: "bg-violet-tint", text: "text-[#5848C2]" },
  { bg: "bg-accent-tint", text: "text-accent" },
  { bg: "bg-warning-tint", text: "text-warning" },
] as const;

type HomeScreenProps = {
  /** Premier affichage de l'application : la marque occupe l'écran puis s'élève comme une voile. */
  intro?: boolean;
};

export function HomeScreen({ intro = false }: HomeScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const resetSearchWizard = useSearchWizardStore((s) => s.reset);
  const user = useAuthStore((s) => s.user);

  const sail = useSail({ intro });
  const liftSail = sail.lift;
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);

  // Le splash ne s'efface plus seul : une fois le chargement fini (temps minimum ET session restaurée, ou plafond en cas de
  // lenteur), le bouton « Commencer » apparaît et c'est son toucher qui élève la voile.
  const [splashMaxElapsed, setSplashMaxElapsed] = useState(false);
  useEffect(() => {
    if (!intro) return;
    const min = setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS);
    const max = setTimeout(() => setSplashMaxElapsed(true), SPLASH_MAX_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, [intro]);
  const splashReady = splashMaxElapsed || (splashMinElapsed && hasHydrated);
  const barStyle = useRevealStyle(sail.progress, 60);
  // Le contenu se révèle pendant que la voile s'élève, au lieu de s'animer caché derrière elle.
  const contentStyle = useRevealStyle(sail.progress, 24, 0.25);
  const bandHeight = insets.top + BAND_HEIGHT;

  // La recherche s'allonge sur place (la barre grandit et contient le formulaire) : plus de feuille par-dessus l'écran.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchCycle, setSearchCycle] = useState<string | undefined>(undefined);
  const openSearch = (cycle?: string) => {
    resetSearchWizard();
    setSearchCycle(cycle);
    setSearchOpen(true);
    scrollRef.current?.scrollTo({ y: Math.max(0, searchBlockY.current - bandHeight - 12), animated: true });
  };
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  // Retour Android : referme la recherche avant de quitter l'écran.
  useEffect(() => {
    if (!searchOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setSearchOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [searchOpen]);
  const { height: windowHeight } = useWindowDimensions();
  // La barre est dans la page (sous le carrousel) : ouverte, elle s'allonge vers le bas et la page défile pour la montrer en entier.
  const searchExpandedHeight = Math.round(windowHeight * 0.74);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const searchBlockY = useRef(0);
  // Hauteur de la photo : la moitié de l'écran (bornée) ; la carte en verre chevauche son bas, au milieu du téléphone.
  const heroHeight = Math.min(460, Math.max(340, Math.round(windowHeight * 0.5)));

  // Le bandeau est transparent en haut de page (la photo se voit derrière le logo et le titre) ; il reprend son fond dès que la
  // page défile, et quand la recherche est ouverte (le texte blanc ne doit jamais se retrouver sur le fond clair de la page).
  const scrollY = useSharedValue(0);
  const searchSolid = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  useEffect(() => {
    searchSolid.set(withTiming(searchOpen ? 1 : 0, { duration: 250 }));
  }, [searchOpen, searchSolid]);
  const backdrop = useDerivedValue(() => Math.max(interpolate(scrollY.get(), [0, 60], [0, 1], "clamp"), searchSolid.get()));
  const goToTutorIntro = () => router.push(TUTOR_INTRO_ROUTE);
  const goToLogin = () => router.push(LOGIN_ROUTE);
  const goToSignup = () => router.push(SIGNUP_ROUTE);
  const goToMySpace = () => router.push(isApprovedTutor(user) ? MODE_CHOICE_ROUTE : APPRENTI_DASHBOARD_ROUTE);

  // Fin de phrase du bandeau (« Trouvez le bon tuteur … ») : elle change en boucle, avec son icône. Elle remplace l'ancien carrousel.
  const headlineItems: HeadlineItem[] = [
    { key: "near", Icon: LocationIcon, text: t("screens.home.headlineNear") },
    { key: "online", Icon: VideoIcon, text: t("screens.home.headlineOnline") },
    { key: "rooms", Icon: HouseIcon, text: t("screens.home.headlineRooms") },
    { key: "verified", Icon: VerifiedBadgeIcon, text: t("screens.home.headlineVerified") },
    { key: "levels", Icon: LevelIcon, text: t("screens.home.headlineLevels") },
  ];

  /** Invitation aux enseignants : l'ancienne carte du carrousel, devenue un lien discret. */
  const teacherInvite = (
    <View className="flex-row items-center justify-center">
      <Text className="text-[14px] text-ink-soft font-body">{t("screens.home.doYouTeach")} </Text>
      <PressableScale onPress={goToTutorIntro} accessibilityLabel={t("screens.home.doYouTeachBecomeA")}>
        <Text className="py-1 text-[14px] text-primary font-body-semibold">{t("screens.home.becomeATutor")}</Text>
      </PressableScale>
    </View>
  );

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="light" />

      <Animated.View style={[{ flex: 1 }, contentStyle]}>
        <Animated.ScrollView
          ref={scrollRef}
          className="flex-1"
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            // Visiteur : colonne pleine hauteur (photo, carte de recherche au milieu, puis les actions au pouce) ;
            // 12 px + la zone sûre du bas (barre de navigation Android) donnent les ~24 px de confort sous les boutons.
            ...(user ? {} : { flexGrow: 1 }),
            paddingBottom: user ? AUTH_BAR_SPACE + Math.max(insets.bottom, 12) : Math.max(insets.bottom, 12) + 12,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo (celle de la connexion) derrière le bandeau : voile indigo en haut pour la lisibilité, puis fondu vers la page. */}
          <View pointerEvents="none" style={{ height: heroHeight }}>
            <Image
              source={HOME_HERO}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
              contentFit="cover"
              contentPosition={{ top: 0, left: "38%" }}
              accessible={false}
            />
            <LinearGradient
              colors={["rgba(33,28,94,0.62)", "rgba(33,28,94,0.34)", PAPER]}
              locations={[0, 0.58, 1]}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
          </View>

          {/* Carte en verre dépoli, plus sombre et plus opaque que celle de la connexion : elle chevauche la photo et porte le
              sur-titre, le titre et la recherche « Chercher » (qui s'allonge sur place). */}
          <View className="px-4" style={{ marginTop: -CARD_OVERLAP }} onLayout={(event) => (searchBlockY.current = event.nativeEvent.layout.y)}>
            <GlassSurface
              tint="rgba(33,28,94,0.6)"
              fallbackTint="rgba(33,28,94,0.94)"
              intensity={70}
              style={{ borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.26)", paddingHorizontal: 12, paddingVertical: 18 }}
            >
              <FadeIn delay={80}>
                <View className="items-center px-4">
                  <Text className="text-[11.5px] uppercase font-body-semibold" style={{ color: "#8D7FE3", letterSpacing: 1.4 }}>
                    {t("screens.home.carouselEyebrow")}
                  </Text>
                  <Text className="mt-2 text-center text-[22px] leading-[28px] font-bold font-display text-white">{t("screens.home.carouselTitle")}</Text>
                </View>
                <View className="pt-4">
                  <ExpandingSearch
                    open={searchOpen}
                    onClose={closeSearch}
                    cycle={searchCycle}
                    pulse={sail.lifted}
                    collapsedHeight={SEARCH_BAR_HEIGHT}
                    collapsedRadius={SEARCH_BAR_HEIGHT / 2}
                    expandedHeight={searchExpandedHeight}
                    style={{ shadowColor: "#14162B", shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}
                    collapsed={
                      <PressableScale onPress={() => openSearch()} accessibilityLabel={t("screens.home.searchCta")}>
                        {/* Une vraie barre de recherche : un seul mot à gauche, et à droite la loupe, grosse, dans un rond primaire. */}
                        <View className="flex-row items-center gap-3 pl-6 pr-[7px]" style={{ height: SEARCH_BAR_HEIGHT }}>
                          <Text className="flex-1 text-[17px] text-ink font-body-semibold">{t("screens.home.searchCta")}</Text>
                          <View className="h-[44px] w-[44px] items-center justify-center rounded-full bg-primary">
                            <SearchIcon size={24} color="#FFFFFF" />
                          </View>
                        </View>
                      </PressableScale>
                    }
                  />
                </View>
              </FadeIn>
            </GlassSurface>
          </View>

          {user ? (
            // Connecté : recherches tendances et tuteurs à découvrir (la barre fixe du bas mène à « Mon espace »).
            <>
              <DiscoverSections onPick={() => openSearch()} />
              <View className="mt-6">{teacherInvite}</View>
            </>
          ) : (
            // Visiteur : les actions calées en bas de l'écran (bouton plein « Se connecter », lien « Créer un compte », lien enseignants).
            <>
              <View style={{ flex: 1, minHeight: 20 }} />
              <FadeIn delay={120}>
                <View className="px-5 pt-5">
                  <Button label={t("common.signIn")} variant="animated" animatedGlow onPress={goToLogin} />
                  <View className="mt-4 flex-row items-center justify-center">
                    <Text className="text-[14px] text-ink-soft font-body">{t("screens.login.donTHaveAnAccount")} </Text>
                    <PressableScale onPress={goToSignup} accessibilityLabel={t("common.createAnAccount")}>
                      <Text className="py-1 text-[14px] text-primary font-body-semibold">{t("common.createAnAccount")}</Text>
                    </PressableScale>
                  </View>
                  <View className="mt-1">{teacherInvite}</View>
                </View>
              </FadeIn>
            </>
          )}
        </Animated.ScrollView>
      </Animated.View>

      <SailHeader
        progress={sail.progress}
        lifted={sail.lifted}
        compactHeight={bandHeight}
        backdrop={backdrop}
        expanded={
          <SplashBrand tagline={t("screens.splash.theRightSupportInThe")} ready={splashReady} startLabel={t("screens.splash.start")} onStart={liftSail} />
        }
        compact={
          <View className="flex-1 px-5" style={{ paddingTop: insets.top + 12 }}>
            <View className="flex-row items-center justify-between">
              <Logo inverted size={34} />
              <LanguageSelector />
            </View>
            <Text className="mt-[14px] text-[22px] font-bold font-display leading-[27px] text-white">{t("screens.home.headlinePrefix")}</Text>
            <View className="mt-1">
              <RotatingHeadline items={headlineItems} />
            </View>
          </View>
        }
      />

      {/* Accès à « Mon espace » (connecté seulement) : barre fixe, fond opaque pleine largeur. Le visiteur a ses boutons dans la page. */}
      {user ? (
      <Animated.View pointerEvents={sail.lifted ? "box-none" : "none"} style={[{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20 }, barStyle]}>
        <View
          className="flex-row items-center gap-[10px] rounded-t-3xl border-t border-line bg-surface px-4 pt-3"
          style={{
            paddingBottom: Math.max(insets.bottom, 12) + 4,
            shadowColor: "#1E1B4B",
            shadowOpacity: 0.1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: -6 },
            elevation: 14,
          }}
        >
          <View className="flex-1">
            <Button label={t("screens.home.mySpace", { firstName: user.firstName })} variant="animated" animatedGlow onPress={goToMySpace} fullWidth />
          </View>
        </View>
      </Animated.View>
      ) : null}
    </View>
  );
}

/** Recherches tendances puis tuteurs à découvrir : chargés (et affichés) seulement pour un utilisateur connecté. */
function DiscoverSections({ onPick }: { onPick: () => void }) {
  const { t } = useTranslation();
  const { state: popularCategories, retry } = usePopularCategories();
  const recommendedTutors = useRecommendedTutors();
  return (
    <>
      <FadeIn delay={100}>
        <View className="mt-8">
          <Text className="mb-3 px-5 text-[17px] font-bold font-display text-ink">{t("screens.home.popularSearches")}</Text>
          <PopularCategories state={popularCategories} onRetry={retry} onPick={onPick} />
        </View>
      </FadeIn>

      <FadeIn delay={160}>
        <View className="mt-8 px-5">
          <RecommendedTutors title={t("screens.home.tutorsToDiscover")} source={recommendedTutors} />
        </View>
      </FadeIn>
    </>
  );
}

type PopularCategoriesProps = {
  state: ReturnType<typeof usePopularCategories>["state"];
  onRetry: () => void;
  /** Un toucher ouvre la recherche : l'entonnoir commence toujours par le niveau. */
  onPick: () => void;
};

function PopularCategories({ state, onRetry, onPick }: PopularCategoriesProps) {
  const { t } = useTranslation();
  if (state.status === "loading") {
    return (
      <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
        {[128, 110, 90, 100].map((width) => (
          <View key={width} className="h-[40px] rounded-full bg-line-soft" style={{ width }} />
        ))}
      </ScrollView>
    );
  }

  if (state.status === "error") {
    return (
      <View className="flex-row items-center gap-3 px-5">
        <Text className="flex-1 text-[13.5px] text-error">{state.message}</Text>
        <PressableScale onPress={onRetry} accessibilityLabel={t("screens.home.tryLoadingThePopularSearches")}>
          <Text className="text-[13.5px] font-semibold text-primary">{t("common.tryAgain")}</Text>
        </PressableScale>
      </View>
    );
  }

  if (state.status === "empty") {
    return <Text className="px-5 text-[13.5px] text-ink-faint">{t("screens.home.noPopularSearchesAtThe")}</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
      {state.categories.map((category, index) => {
        const tint = TREND_TINTS[index % TREND_TINTS.length];
        return (
          <PressableScale key={category.id} onPress={onPick} accessibilityLabel={category.label}>
            <View className={["rounded-full px-4 py-[10px]", tint.bg].join(" ")}>
              <Text className={["text-[13.5px] font-body-semibold", tint.text].join(" ")}>{category.label}</Text>
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}
