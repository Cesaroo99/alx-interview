import React, { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, usePathname } from "expo-router";

import { useColors } from "@/src/theme/colors";
import { useTypeScale } from "@/src/theme/typography";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { useDocuments } from "@/src/state/documents";
import { useInsights } from "@/src/state/insights";
import { useProfile } from "@/src/state/profile";
import { useVisaTimeline } from "@/src/state/visa_timeline";

type NavItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  href: string;
  showBadge?: boolean;
};

function isActive(pathname: string, href: string) {
  const p = String(pathname || "");
  const h = String(href || "");
  if (!h) return false;
  if (h === "/") return p === "/" || p === "/(tabs)" || p === "/(tabs)/index";
  if (p === h) return true;
  return p.startsWith(h + "/");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const compact = width < 960;
  const isMobile = width < 720;
  const showRight = width >= 1180;
  const [menuOpen, setMenuOpen] = useState(false);
  const colors = useColors();
  const type = useTypeScale();

  const { profile } = useProfile();
  const { docs } = useDocuments();
  const { insights } = useInsights();
  const { state: timelineState } = useVisaTimeline();

  const hideChrome = useMemo(() => {
    const p = String(pathname || "");
    // Écrans "full focus" / modaux: pas de sidebar
    return (
      p.startsWith("/onboarding") ||
      p.startsWith("/portal") ||
      p.startsWith("/documents/add") ||
      p.startsWith("/documents/edit") ||
      p.startsWith("/modal")
    );
  }, [pathname]);

  const profileIncomplete = useMemo(() => {
    if (!profile) return true;
    if (!profile.nationality || !profile.profession || !Number.isFinite(profile.age)) return true;
    if (!profile.country_of_residence) return true;
    return false;
  }, [profile]);

  const activeVisa = useMemo(() => {
    const visas = timelineState.visas || [];
    if (!visas.length) return null;
    // Visa "active" = plus récemment mis à jour
    return visas.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
  }, [timelineState.visas]);

  const activeProcedureId = useMemo(() => {
    const fromState = String(timelineState.activeProcedureId || "").trim();
    if (fromState) return fromState;
    return activeVisa?.id || null;
  }, [activeVisa?.id, timelineState.activeProcedureId]);

  const navItems: NavItem[] = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", icon: "home", href: "/(tabs)" },
      { key: "profile", label: "Profil", icon: "user", href: "/profile", showBadge: profileIncomplete },
      { key: "journey", label: "Visa Journey", icon: "road", href: activeProcedureId ? `/visa/${activeProcedureId}` : "/(tabs)/parcours" },
      { key: "dossier", label: "Dossier", icon: "folder", href: "/(tabs)/dossier" },
      { key: "documents", label: "Documents", icon: "file-text", href: "/(tabs)/documents" },
      { key: "copilot", label: "Copilot", icon: "comments", href: "/(tabs)/copilot" },
      { key: "tools", label: "Tools", icon: "wrench", href: "/(tabs)/tools" },
    ],
    [activeProcedureId, profileIncomplete]
  );

  const contextLines = useMemo(() => {
    const lines: string[] = [];
    if (activeVisa) {
      lines.push(`Procédure active: ${activeVisa.country} · ${activeVisa.visaType}`);
    } else if (activeProcedureId) {
      const dr = insights?.lastDossier?.destination_region || profile?.destination_region_hint;
      const vt = insights?.lastDossier?.visa_type;
      lines.push(`Procédure active: ${dr ? String(dr) : activeProcedureId}${vt ? ` · ${vt}` : ""}`);
    } else {
      lines.push("Aucune procédure active.");
    }
    if (insights?.lastDossier?.readiness_level) {
      lines.push(`Dossier: ${insights.lastDossier.readiness_level} · ${Math.round(insights.lastDossier.readiness_score || 0)}/100`);
    }
    if (!docs.some((d) => d.doc_type === "passport")) lines.push("Bloquant probable: passeport manquant.");
    return lines.slice(0, 4);
  }, [activeProcedureId, activeVisa, docs, insights?.lastDossier?.destination_region, insights?.lastDossier?.readiness_level, insights?.lastDossier?.readiness_score, insights?.lastDossier?.visa_type, profile?.destination_region_hint]);

  if (hideChrome) return <>{children}</>;

  const bottomNavH = isMobile ? 64 : 0;
  const fabBottom = (isMobile ? bottomNavH + 14 : 18) as number;

  return (
    <View style={[styles.shell, { backgroundColor: colors.bg }]}>
      {/* LEFT SIDEBAR (desktop/tablette) */}
      {!isMobile ? (
        <View style={[styles.sidebar, { backgroundColor: colors.navBg, borderRightColor: colors.navBorder }, compact ? styles.sidebarCompact : null]}>
          <Text style={[styles.brand, compact ? styles.brandCompact : null]}>Visa Copilot AI</Text>
          <View style={{ height: Tokens.space.md }} />
          {navItems.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Pressable
                key={it.key}
                onPress={() => router.push(it.href as any)}
                style={[
                  styles.navItem,
                  active ? [styles.navItemActive, { backgroundColor: colors.navItemBgActive, borderColor: colors.navItemBorderActive }] : null,
                ]}>
                <View style={styles.iconWrap}>
                  <FontAwesome name={it.icon} size={18} color={active ? colors.navItemIconActive : colors.navItemIconInactive} />
                  {it.showBadge ? <View style={[styles.badgeDot, { backgroundColor: colors.warning }]} /> : null}
                </View>
                {!compact ? (
                  <Text
                    style={[
                      styles.navLabel,
                      type.bodyStrong,
                      { color: colors.navLabelInactive },
                      active ? [styles.navLabelActive, { color: colors.text }] : null,
                    ]}>
                    {it.label}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}

          <View style={{ flex: 1 }} />
          {!compact ? (
            <View style={{ paddingTop: Tokens.space.md }}>
              <Text style={[styles.smallMuted, type.caption, { color: colors.faint }]}>Official‑only · No submission</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* MAIN CONTENT */}
      <View style={styles.main}>
        <View style={[styles.mainInner, isMobile ? { paddingBottom: bottomNavH } : null]}>{children}</View>
      </View>

      {/* RIGHT CONTEXT PANEL */}
      {showRight && Platform.OS === "web" ? (
        <View style={[styles.right, { borderLeftColor: colors.border }]}>
          <GlassCard>
            <Text style={[styles.rightTitle, type.h3, { color: colors.text }]}>Contexte</Text>
            <View style={{ height: Tokens.space.sm }} />
            {contextLines.map((l) => (
              <Text key={l} style={[styles.rightText, type.body, { color: colors.muted }]}>
                - {l}
              </Text>
            ))}
            <View style={{ height: Tokens.space.md }} />
            <PrimaryButton title="Ouvrir Copilot" onPress={() => router.push("/(tabs)/copilot")} />
            <View style={{ height: Tokens.space.sm }} />
            <PrimaryButton title="Vérif finale" variant="ghost" onPress={() => router.push("/tools/final_check")} />
          </GlassCard>
        </View>
      ) : null}

      {/* MOBILE: Bottom nav + drawer */}
      {isMobile ? (
        <>
          <View style={[styles.mobileNav, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <Pressable
              onPress={() => setMenuOpen(true)}
              style={[styles.mobileItem, menuOpen ? { opacity: 0.85 } : null]}>
              <FontAwesome name="bars" size={18} color={colors.text} />
              <Text style={[styles.mobileLabel, type.caption, { color: colors.faint }]}>Menu</Text>
            </Pressable>

            {["dashboard", "journey", "documents", "copilot"].map((k) => {
              const it = navItems.find((x) => x.key === k)!;
              const active = isActive(pathname, it.href);
              return (
                <Pressable
                  key={it.key}
                  onPress={() => router.push(it.href as any)}
                  style={[styles.mobileItem, active ? styles.mobileItemActive : null]}>
                  <FontAwesome name={it.icon} size={18} color={active ? colors.brandA : colors.text} />
                  <Text
                    style={[
                      styles.mobileLabel,
                      type.caption,
                      { color: colors.faint },
                      active ? [styles.mobileLabelActive, { color: colors.text }] : null,
                    ]}>
                    {it.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {menuOpen ? (
            <Pressable style={styles.drawerOverlay} onPress={() => setMenuOpen(false)}>
              <Pressable style={[styles.drawerCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => void 0}>
                <Text style={[styles.drawerTitle, type.h2, { color: colors.text }]}>Navigation</Text>
                <View style={{ height: Tokens.space.sm }} />
                {navItems.map((it) => {
                  const active = isActive(pathname, it.href);
                  return (
                    <Pressable
                      key={it.key}
                      onPress={() => {
                        setMenuOpen(false);
                        router.push(it.href as any);
                      }}
                      style={[styles.drawerItem, active ? styles.drawerItemActive : null]}>
                      <FontAwesome name={it.icon} size={18} color={active ? colors.brandA : colors.text} />
                      <Text style={[styles.drawerLabel, type.bodyStrong, { color: colors.text }]}>{it.label}</Text>
                      {it.showBadge ? <View style={[styles.drawerBadgeDot, { backgroundColor: colors.warning }]} /> : null}
                    </Pressable>
                  );
                })}
              </Pressable>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {/* Floating Copilot */}
      <Pressable
        onPress={() => router.push("/(tabs)/copilot")}
        style={[styles.fab, { bottom: fabBottom }, Platform.OS === "web" ? styles.fabWeb : null]}>
        <FontAwesome name="comments" size={18} color={colors.onBrand} />
        {!compact && !isMobile ? <Text style={styles.fabText}>Copilot</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 240,
    paddingTop: Tokens.space.xl,
    paddingHorizontal: Tokens.space.md,
    paddingBottom: Tokens.space.lg,
    borderRightWidth: 1,
  },
  sidebarCompact: { width: 72, paddingHorizontal: 10 },
  brand: { color: "#F3F6FF", fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.black },
  brandCompact: { fontSize: Tokens.font.size.sm, lineHeight: 16 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Tokens.radius.lg,
  },
  navItemActive: { borderWidth: 1 },
  navLabel: {},
  navLabelActive: {},
  iconWrap: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  badgeDot: { position: "absolute", top: 1, right: 1, width: 8, height: 8, borderRadius: 99 },
  smallMuted: {},
  main: { flex: 1 },
  mainInner: { flex: 1 },
  right: { width: 320, padding: Tokens.space.lg, borderLeftWidth: 1 },
  rightTitle: {},
  rightText: { marginTop: 6 },
  mobileNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: Tokens.space.sm,
    borderTopWidth: 1,
  },
  mobileItem: { alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, paddingHorizontal: 6, minWidth: 64 },
  mobileItemActive: { backgroundColor: "rgba(124,92,255,0.10)", borderRadius: Tokens.radius.md },
  mobileLabel: {},
  mobileLabelActive: {},
  drawerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: Tokens.space.lg,
    justifyContent: "flex-end",
  },
  drawerCard: {
    borderRadius: Tokens.radius.xl,
    padding: Tokens.space.lg,
    borderWidth: 1,
  },
  drawerTitle: {},
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Tokens.radius.lg,
  },
  drawerItemActive: { backgroundColor: "rgba(124,92,255,0.12)" },
  drawerLabel: { flex: 1 },
  drawerLabelActive: {},
  drawerBadgeDot: { width: 10, height: 10, borderRadius: 99 },
  fab: {
    position: "absolute",
    right: 18,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "rgba(124,92,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  fabWeb: { boxShadow: "0px 10px 24px rgba(0,0,0,0.28)" as any },
  fabText: { color: "#FFFFFF", fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold },
});

