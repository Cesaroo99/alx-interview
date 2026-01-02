import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Api, type FormsCatalogResponse, type FormsSuggestResponse, type FormsValidateResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useDocuments } from "@/src/state/documents";
import { useInsights } from "@/src/state/insights";
import { useProfile } from "@/src/state/profile";
import { useVisaTimeline } from "@/src/state/visa_timeline";

function norm(s?: string) {
  return String(s || "").trim();
}

export default function FormsDraftScreen() {
  const params = useLocalSearchParams<{ form_type?: string }>();
  const { profile } = useProfile();
  const { insights } = useInsights();
  const { docs } = useDocuments();
  const { upsertVisa, addManualEvent } = useVisaTimeline();

  const [catalog, setCatalog] = useState<FormsCatalogResponse | null>(null);
  const [formType, setFormType] = useState("schengen_visa");
  const [tpl, setTpl] = useState<FormsCatalogResponse["form"] | null>(null);

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftTitle, setDraftTitle] = useState("");
  const [saved, setSaved] = useState<Array<{ id: string; form_type: string; title: string; draft: Record<string, string>; createdAt: number; updatedAt: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<FormsSuggestResponse | null>(null);
  const [validation, setValidation] = useState<FormsValidateResponse | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    const ft = norm(params?.form_type);
    if (ft) setFormType(ft);
  }, [params?.form_type]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("globalvisa.form_drafts.v1");
        if (raw) setSaved(JSON.parse(raw));
      } catch {
        setSaved([]);
      }
    })();
  }, []);

  async function persistSaved(next: any) {
    setSaved(next);
    await AsyncStorage.setItem("globalvisa.form_drafts.v1", JSON.stringify(next));
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await Api.formsCatalog();
        setCatalog(res);
      } catch {
        setCatalog(null);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await Api.formsCatalog(formType);
        setTpl(res.form || null);
        setDraft({});
        setDraftTitle(`${(res.form?.label || res.form?.form_type || formType) as string} — ${new Date().toISOString().slice(0, 10)}`);
        setSuggestions(null);
        setValidation(null);
      } catch (e: any) {
        setError(String(e?.message || e));
        setTpl(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [formType]);

  const fields = useMemo(() => (tpl?.fields || []).map((f) => ({ name: String(f.name || ""), label: String(f.label || f.name || ""), required: !!f.required })), [tpl?.fields]);

  const exportText = useMemo(() => {
    if (!tpl) return "";
    const lines = fields
      .map((f) => {
        const v = norm(draft[f.name]);
        return `${f.label}${f.required ? " *" : ""}: ${v || "—"}`;
      })
      .join("\n");
    const warnings = validation?.warnings?.length ? `\n\nWarnings:\n- ${validation.warnings.join("\n- ")}` : "";
    const errors2 = validation?.errors?.length ? `\n\nErrors:\n- ${validation.errors.join("\n- ")}` : "";
    return [`Form: ${tpl.form_type}`, "", lines, warnings, errors2].filter(Boolean).join("\n");
  }, [draft, fields, tpl, validation?.errors, validation?.warnings]);

  const portalHint = useMemo(() => {
    const d = insights?.lastDossier;
    return {
      country: String(d?.destination_region || profile?.destination_region_hint || "unknown"),
      visaType: String(d?.visa_type || "unknown"),
      objective: String(d?.objective || profile?.travel_purpose || "visa"),
    };
  }, [insights?.lastDossier, profile?.destination_region_hint, profile?.travel_purpose]);

  const payloadDocs = useMemo(
    () =>
      (docs || []).map((d) => ({
        doc_id: d.id,
        doc_type: d.doc_type,
        filename: d.filename,
        extracted: d.extracted || {},
      })),
    [docs]
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Form Draft (guidé)</Text>
        <Text style={styles.subtitle}>Remplissez un brouillon structuré, validez, exportez, puis copiez/collez dans le portail officiel.</Text>
      </View>

      {!profile ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Profil requis</Text>
          <Text style={styles.body}>Pour proposer des valeurs, l’app a besoin de votre profil.</Text>
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton title="Faire l’onboarding" onPress={() => router.push("/onboarding")} />
        </GlassCard>
      ) : null}

      <GlassCard>
        <Text style={styles.cardTitle}>Choisir un template</Text>
        <View style={{ height: Tokens.space.sm }} />
        <View style={styles.row2}>
          {(catalog?.forms || []).slice(0, 6).map((f) => (
            <PrimaryButton
              key={String(f.form_type)}
              title={String(f.label || f.form_type)}
              variant={formType === f.form_type ? "brand" : "ghost"}
              onPress={() => setFormType(String(f.form_type))}
              style={{ flex: 1 }}
            />
          ))}
        </View>
        {catalog?.disclaimer ? <Text style={styles.hint}>{catalog.disclaimer}</Text> : null}
      </GlassCard>

      {saved.length ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Brouillons sauvegardés</Text>
          <Text style={styles.body}>Charge un brouillon existant (stocké localement).</Text>
          {saved
            .filter((x) => !formType || x.form_type === formType)
            .slice(0, 5)
            .map((x) => (
              <View key={x.id} style={styles.rowSaved}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedTitle}>{x.title}</Text>
                  <Text style={styles.hint}>Form: {x.form_type} · maj: {new Date(x.updatedAt).toISOString().slice(0, 10)}</Text>
                </View>
                <View style={{ width: 160, gap: 8 }}>
                  <PrimaryButton
                    title="Charger"
                    variant="ghost"
                    onPress={() => {
                      setFormType(x.form_type);
                      setDraft(x.draft || {});
                      setDraftTitle(x.title);
                    }}
                  />
                  <PrimaryButton title="Suppr." variant="ghost" onPress={() => persistSaved(saved.filter((y) => y.id !== x.id))} />
                </View>
              </View>
            ))}
        </GlassCard>
      ) : null}

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Chargement du template…</Text>
          </View>
        </GlassCard>
      ) : error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
        </GlassCard>
      ) : tpl ? (
        <>
          <GlassCard>
            <Text style={styles.cardTitle}>Brouillon</Text>
            <Text style={styles.body}>{tpl.label || tpl.form_type}</Text>
            <View style={{ height: Tokens.space.md }} />

            <Text style={styles.label}>Titre (optionnel)</Text>
            <TextInput value={draftTitle} onChangeText={setDraftTitle} placeholder="Ex: DS-160 — Jan 2026" placeholderTextColor="rgba(16,22,47,0.35)" style={styles.input} />

            <View style={styles.row2}>
              <PrimaryButton
                title="Pré-remplir (profil)"
                variant="ghost"
                onPress={async () => {
                  if (!profile) return;
                  setLoading(true);
                  setError(null);
                  try {
                    const res = await Api.formsSuggest({
                      profile,
                      form_type: tpl.form_type,
                      fields: fields.map((f) => f.name),
                      context: { country: portalHint.country, visa_type: portalHint.visaType, objective: portalHint.objective },
                      documents: payloadDocs,
                    });
                    setSuggestions(res);
                    setDraft((prev) => {
                      const next = { ...prev };
                      for (const s of res.suggestions || []) {
                        const name = String(s.field_name || "").trim();
                        const val = s.suggested_value == null ? "" : String(s.suggested_value);
                        if (!name || !val) continue;
                        if (!String(next[name] || "").trim()) next[name] = val;
                      }
                      return next;
                    });
                  } catch (e: any) {
                    setError(String(e?.message || e));
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Valider"
                onPress={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const res = await Api.formsValidate({ form_type: tpl.form_type, draft_values: draft });
                    setValidation(res);
                  } catch (e: any) {
                    setError(String(e?.message || e));
                    setValidation(null);
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{ flex: 1 }}
              />
            </View>

            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.row2}>
              <PrimaryButton
                title="Sauver"
                variant="ghost"
                onPress={async () => {
                  const id = `draft_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                  const item = { id, form_type: tpl.form_type, title: draftTitle.trim() || tpl.form_type, draft, createdAt: Date.now(), updatedAt: Date.now() };
                  await persistSaved([item, ...saved]);
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton title="Exporter" variant="ghost" onPress={() => setExportOpen(true)} style={{ flex: 1 }} />
              <PrimaryButton
                title="Ouvrir Portail + Assistant"
                onPress={() =>
                  router.push({
                    pathname: "/portal",
                    params: {
                      url: "https://",
                      country: portalHint.country,
                      visa_type: portalHint.visaType,
                      stage: "application",
                      objective: portalHint.objective,
                      form_type: tpl.form_type,
                      assistant: "1",
                    } as any,
                  })
                }
                style={{ flex: 1 }}
              />
            </View>

            <View style={{ height: Tokens.space.sm }} />
            <PrimaryButton
              title="Sauver dans la timeline"
              variant="ghost"
              onPress={async () => {
                if (!profile) return;
                const visaId = await upsertVisa({
                  country: String(portalHint.country || "unknown"),
                  visaType: String(portalHint.visaType || "unknown"),
                  objective: String(profile.travel_purpose || "visa"),
                  stage: "application",
                });
                await addManualEvent({
                  visaId,
                  type: "other",
                  title: `Brouillon formulaire: ${draftTitle.trim() || tpl.form_type}`,
                  notes: exportText,
                  meta: { form_type: tpl.form_type, draft },
                });
              }}
            />

            {validation?.errors?.length ? (
              <Text style={[styles.hint, { color: Colors.warning }]}>Erreurs: {validation.errors.join(" · ")}</Text>
            ) : validation?.ok ? (
              <Text style={[styles.hint, { color: Colors.brandB }]}>Validation OK (estimée).</Text>
            ) : null}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Champs</Text>
            <Text style={styles.body}>Astuce: utilisez “Pré-remplir” puis complétez uniquement les champs manquants.</Text>
            {fields.map((f) => {
              const sug = (suggestions?.suggestions || []).find((x) => x.field_name === f.name) || null;
              return (
                <View key={f.name} style={{ marginTop: Tokens.space.md }}>
                  <Text style={styles.label}>
                    {f.label} {f.required ? "*" : ""}
                  </Text>
                  <TextInput
                    value={String(draft[f.name] || "")}
                    onChangeText={(t) => setDraft((p) => ({ ...p, [f.name]: t }))}
                    placeholder={sug?.suggested_value ? `Suggestion: ${sug.suggested_value}` : "—"}
                    placeholderTextColor="rgba(16,22,47,0.35)"
                    style={styles.input}
                  />
                  {sug?.explanation ? <Text style={styles.hint}>{sug.explanation}</Text> : null}
                </View>
              );
            })}
          </GlassCard>
        </>
      ) : null}

      {exportOpen ? (
        <View style={styles.overlay}>
          <GlassCard>
            <Text style={styles.cardTitle}>Export</Text>
            <Text style={styles.body}>Copiez ce brouillon, puis collez-le dans vos notes ou pour le remplissage.</Text>
            <TextInput value={exportText} editable={false} multiline style={[styles.input, { minHeight: 220 }]} />
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton
                title="Copier"
                onPress={async () => {
                  await Clipboard.setStringAsync(exportText);
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton title="Fermer" variant="ghost" onPress={() => setExportOpen(false)} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  label: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.medium },
  hint: { marginTop: Tokens.space.sm, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  row2: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" },
  input: {
    marginTop: 8,
    borderRadius: Tokens.radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.md,
    color: Colors.text,
    fontSize: Tokens.font.size.md,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: Tokens.space.xl },
  rowSaved: { flexDirection: "row", gap: 12, marginTop: Tokens.space.md, alignItems: "flex-start" },
  savedTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold, lineHeight: 22 },
});

