import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { router } from "expo-router";

import { Api, type FormDefinition, type Procedure, type ProcedureStep } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

function pickLabel(obj: any, locale: "fr" | "en") {
  if (obj && typeof obj === "object") return obj[locale] || obj.fr || obj.en || Object.values(obj)[0];
  return "";
}

export default function StepRunner() {
  const { procedureId, stepId } = useLocalSearchParams<{ procedureId: string; stepId: string }>();
  const pid = String(procedureId || "");
  const sid = String(stepId || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proc, setProc] = useState<Procedure | null>(null);
  const [steps, setSteps] = useState<ProcedureStep[]>([]);
  const [form, setForm] = useState<FormDefinition | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [ai, setAi] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const locale = (proc?.locale === "en" ? "en" : "fr") as "fr" | "en";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const all = await Api.listProcedures();
        const found = (all.items || []).find((x) => x.id === pid) || null;
        const s = await Api.listProcedureSteps(pid);
        const d = await Api.getDraft(pid, sid);
        if (!cancelled) {
          setProc(found);
          setSteps(s.items || []);
          setDraft(d.data || {});
        }
        if (found?.form_id) {
          const f = await Api.getForm(found.form_id);
          if (!cancelled) setForm(f);
        }
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pid, sid]);

  const step = useMemo(() => steps.find((s) => s.id === sid) || null, [steps, sid]);
  const stepDef = useMemo(() => {
    if (!form?.steps || !step) return null;
    return (form.steps as any[]).find((x) => x.key === step.step_key) || null;
  }, [form, step]);

  return (
    <Screen>
      <HeroBanner
        kicker={locale === "fr" ? "Formulaire" : "Form"}
        title={step ? pickLabel(step.title, locale) || step.step_key : "Étape"}
        subtitle={proc ? `${proc.type} · ${proc.country} · ${proc.intent}` : pid}
      />

      {error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
        </GlassCard>
      ) : null}

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>{locale === "fr" ? "Chargement…" : "Loading…"}</Text>
          </View>
        </GlassCard>
      ) : null}

      {stepDef ? (
        <>
          <GlassCard>
            <Text style={styles.cardTitle}>{locale === "fr" ? "Champs" : "Fields"}</Text>
            <Text style={styles.body}>
              {locale === "fr"
                ? "L’IA propose des textes, mais vous restez responsable: rien n’est soumis automatiquement."
                : "AI suggests text, but you stay responsible: nothing is auto-submitted."}
            </Text>
            <View style={{ height: Tokens.space.md }} />

            {(stepDef.fields || []).map((f: any) => {
              const label = pickLabel(f.label, locale) || String(f.id);
              const hint = pickLabel(f.hint, locale);
              const value = draft[f.id] ?? "";
              const multiline = f.type === "textarea";
              return (
                <View key={f.id} style={{ marginTop: Tokens.space.lg }}>
                  <Text style={styles.label}>
                    {label}
                    {f.required ? " *" : ""}
                  </Text>
                  {hint ? <Text style={styles.hint}>{hint}</Text> : null}
                  <TextInput
                    value={String(value)}
                    onChangeText={(t) => setDraft((prev) => ({ ...prev, [f.id]: t }))}
                    style={[styles.input, multiline ? styles.textarea : null]}
                    placeholderTextColor="rgba(246,248,255,0.35)"
                    multiline={multiline}
                  />
                  <View style={{ height: Tokens.space.sm }} />
                  <View style={styles.row2}>
                    <PrimaryButton
                      title={aiLoading ? "…" : locale === "fr" ? "Suggestion IA" : "AI suggestion"}
                      variant="ghost"
                      onPress={async () => {
                        setAiLoading(true);
                        try {
                          await Api.saveDraft(pid, sid, draft);
                          const res = await Api.aiSuggest({
                            procedure_id: pid,
                            step_id: sid,
                            field_id: String(f.id),
                            locale,
                            user_input: String(draft[f.id] ?? ""),
                          });
                          setAi({ fieldId: f.id, payload: res.result });
                        } catch (e: any) {
                          setAi({ fieldId: f.id, payload: { error: String(e?.message || e) } });
                        } finally {
                          setAiLoading(false);
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <PrimaryButton
                      title={locale === "fr" ? "Sauvegarder" : "Save"}
                      onPress={async () => {
                        await Api.saveDraft(pid, sid, draft);
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>

                  {ai?.fieldId === f.id ? (
                    <View style={styles.aiBox}>
                      {ai.payload?.error ? <Text style={styles.error}>{ai.payload.error}</Text> : null}
                      {(ai.payload?.suggestions || []).slice(0, 2).map((s: any) => (
                        <View key={s.text} style={{ marginTop: Tokens.space.sm }}>
                          <Text style={styles.aiText}>{s.text}</Text>
                          {s.rationale ? <Text style={styles.aiMeta}>{s.rationale}</Text> : null}
                          <View style={{ height: Tokens.space.sm }} />
                          <PrimaryButton
                            title={locale === "fr" ? "Insérer dans le champ (action utilisateur)" : "Insert (user action)"}
                            variant="ghost"
                            onPress={() => setDraft((prev) => ({ ...prev, [f.id]: String(s.text || "") }))}
                          />
                        </View>
                      ))}
                      {(ai.payload?.warnings || []).length ? (
                        <>
                          <Text style={[styles.aiMeta, { marginTop: Tokens.space.sm }]}>
                            {(ai.payload.warnings || []).slice(0, 3).join(" • ")}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>{locale === "fr" ? "Validation & cohérence" : "Validation & consistency"}</Text>
            <View style={{ height: Tokens.space.md }} />
            <PrimaryButton
              title={aiLoading ? "…" : locale === "fr" ? "Vérifier avec l’IA" : "Validate with AI"}
              onPress={async () => {
                setAiLoading(true);
                try {
                  await Api.saveDraft(pid, sid, draft);
                  const res = await Api.aiValidate({ procedure_id: pid, step_id: sid, locale });
                  setAi({ fieldId: "__validate__", payload: res.result });
                } catch (e: any) {
                  setAi({ fieldId: "__validate__", payload: { error: String(e?.message || e) } });
                } finally {
                  setAiLoading(false);
                }
              }}
            />
            {ai?.fieldId === "__validate__" ? (
              <View style={styles.aiBox}>
                {ai.payload?.error ? <Text style={styles.error}>{ai.payload.error}</Text> : null}
                {(ai.payload?.blocking_issues || []).slice(0, 5).map((x: string) => (
                  <Text key={x} style={styles.aiText}>
                    ⛔ {x}
                  </Text>
                ))}
                {(ai.payload?.global_warnings || []).slice(0, 5).map((x: string) => (
                  <Text key={x} style={styles.aiText}>
                    ⚠️ {x}
                  </Text>
                ))}
                {(ai.payload?.recommended_actions || []).slice(0, 5).map((x: string) => (
                  <Text key={x} style={styles.aiText}>
                    ✅ {x}
                  </Text>
                ))}
              </View>
            ) : null}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>{locale === "fr" ? "Soumission officielle" : "Official submission"}</Text>
            <Text style={styles.body}>
              {locale === "fr"
                ? "Quand vous êtes prêt, ouvrez le site officiel et copiez-collez les champs."
                : "When ready, open the official site and copy-paste fields."}
            </Text>
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton
                title={locale === "fr" ? "Ouvrir site officiel" : "Open official site"}
                onPress={() => (step?.official_url ? Linking.openURL(String(step.official_url)) : undefined)}
                style={{ flex: 1, opacity: step?.official_url ? 1 : 0.6 }}
              />
              <PrimaryButton
                title={locale === "fr" ? "Étape terminée" : "Mark done"}
                variant="ghost"
                onPress={async () => {
                  await Api.saveDraft(pid, sid, draft);
                  const res = await Api.completeStep(pid, sid, locale);
                  setSteps(res.steps || []);
                  router.replace(`/forms/${pid}`);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  label: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.medium },
  hint: { marginTop: 6, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
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
  textarea: { minHeight: 120, textAlignVertical: "top" },
  row2: { flexDirection: "row", gap: 10, alignItems: "center" },
  loadingRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  aiBox: { marginTop: Tokens.space.md, padding: Tokens.space.md, borderRadius: Tokens.radius.lg, borderWidth: 1, borderColor: "rgba(53,230,255,0.20)" },
  aiText: { marginTop: Tokens.space.sm, color: Colors.text, fontSize: Tokens.font.size.md, lineHeight: 22 },
  aiMeta: { marginTop: 6, color: Colors.muted, fontSize: Tokens.font.size.sm, lineHeight: 20 },
});

