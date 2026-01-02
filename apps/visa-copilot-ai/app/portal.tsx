import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useVisaTimeline } from "@/src/state/visa_timeline";
import { Api, type FormsCatalogResponse, type GuideFieldResponse } from "@/src/api/client";
import { useProfile } from "@/src/state/profile";

let NativeWebView: any = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  NativeWebView = require("react-native-webview").WebView;
}

type DetectedMsg = {
  type: "date_detected";
  url: string;
  eventType: string;
  title: string;
  dateIso?: string;
  startDateIso?: string;
  endDateIso?: string;
  snippet?: string;
  confidence?: number;
};

type DetectedFieldMsg = {
  type: "form_fields_detected";
  url: string;
  fields: Array<{ name?: string; id?: string; label?: string; placeholder?: string; tag?: string; inputType?: string; required?: boolean }>;
};

function norm(s?: string) {
  return String(s || "").trim();
}

function toVisaEventType(t: string) {
  const x = norm(t).toLowerCase();
  if (x.includes("biometric")) return "biometrics" as const;
  if (x.includes("appoint")) return "appointment" as const;
  if (x.includes("submit")) return "submission" as const;
  if (x.includes("deadline")) return "deadline" as const;
  if (x.includes("pay")) return "payment" as const;
  if (x.includes("collect")) return "passport_collection" as const;
  if (x.includes("valid")) return "visa_validity" as const;
  if (x.includes("entry")) return "entry_deadline" as const;
  return "other" as const;
}

const INJECTED = `
(function () {
  if (window.__gv_tracker) return;
  window.__gv_tracker = true;

  const monthMap = {
    jan:1, january:1, janvier:1,
    feb:2, february:2, fev:2, fevr:2, fevrier:2, février:2,
    mar:3, march:3, mars:3,
    apr:4, april:4, avr:4, avril:4,
    may:5, mai:5,
    jun:6, june:6, juin:6,
    jul:7, july:7, juil:7, juillet:7,
    aug:8, august:8, aout:8, août:8,
    sep:9, sept:9, september:9, septembre:9,
    oct:10, october:10, octobre:10,
    nov:11, november:11, novembre:11,
    dec:12, december:12, decembre:12, décembre:12
  };

  function pad2(n){ return String(n).padStart(2,'0'); }
  function iso(y,m,d){ return y + '-' + pad2(m) + '-' + pad2(d); }

  function parseDate(s){
    if(!s) return null;
    const t = String(s).trim();
    let m;
    // YYYY-MM-DD
    m = /(\\d{4})-(\\d{2})-(\\d{2})/.exec(t);
    if(m) return { dateIso: iso(m[1], Number(m[2]), Number(m[3])) };
    // DD/MM/YYYY or DD.MM.YYYY
    m = /(\\d{1,2})[\\/\\.](\\d{1,2})[\\/\\.](\\d{4})/.exec(t);
    if(m) return { dateIso: iso(m[3], Number(m[2]), Number(m[1])) };
    // Month DD, YYYY (EN/FR)
    m = /([A-Za-zÀ-ÿ\\.]{3,})\\s+(\\d{1,2})(?:,)?\\s+(\\d{4})/.exec(t);
    if(m){
      const key = m[1].toLowerCase().replace(/\\./g,'');
      const mm = monthMap[key];
      if(mm) return { dateIso: iso(m[3], mm, Number(m[2])) };
    }
    return null;
  }

  function classify(text){
    const s = (text||'').toLowerCase();
    const pairs = [
      ['biometrics','biométrie'],
      ['appointment','rendez-vous'],
      ['submission','soumission'],
      ['deadline','date limite'],
      ['payment','paiement'],
      ['passport_collection','collect'],
      ['visa_validity','valid'],
      ['entry_deadline','entrée']
    ];
    for(const [k,kw] of pairs){
      if(s.includes(k) || s.includes(kw)) return k;
    }
    return 'other';
  }

  function extract(){
    const body = (document.body && document.body.innerText) ? document.body.innerText : '';
    const sample = body.slice(0, 20000);
    const patterns = [
      /(\\d{4}-\\d{2}-\\d{2})/g,
      /(\\d{1,2}[\\/\\.]\\d{1,2}[\\/\\.]\\d{4})/g,
      /([A-Za-zÀ-ÿ\\.]{3,}\\s+\\d{1,2}(?:,)?\\s+\\d{4})/g
    ];
    const hits = [];
    for(const re of patterns){
      let m;
      while((m = re.exec(sample)) !== null){
        hits.push({ raw: m[1], idx: m.index });
        if(hits.length > 18) break;
      }
      if(hits.length > 18) break;
    }
    if(!hits.length) return;

    // Try to pick the best candidate based on nearby keywords
    let best = null;
    for(const h of hits){
      const start = Math.max(0, h.idx - 120);
      const end = Math.min(sample.length, h.idx + 120);
      const snippet = sample.slice(start, end);
      const parsed = parseDate(h.raw);
      if(!parsed) continue;
      const et = classify(snippet);
      const score = (et !== 'other' ? 0.7 : 0.4) + Math.min(0.3, snippet.length/400);
      if(!best || score > best.confidence){
        best = { eventType: et, title: et.replace(/_/g,' '), dateIso: parsed.dateIso, snippet, confidence: score };
      }
    }
    if(!best) return;

    const payload = { type:'date_detected', url: location.href, ...best };
    const hash = JSON.stringify(payload).slice(0, 220);
    if(window.__gv_lastHash === hash) return;
    window.__gv_lastHash = hash;
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  setTimeout(extract, 1200);
  setInterval(extract, 7000);

  function scanFormFields(){
    try{
      const nodes = Array.from(document.querySelectorAll('input,select,textarea')).slice(0, 60);
      const fields = [];
      for(const el of nodes){
        const tag = (el.tagName || '').toLowerCase();
        const id = el.id || '';
        const name = el.name || '';
        const placeholder = el.placeholder || '';
        let label = '';
        if(id){
          const l = document.querySelector('label[for="'+id.replace(/"/g,'')+'"]');
          if(l && l.innerText) label = l.innerText.trim();
        }
        if(!label){
          const parentLabel = el.closest && el.closest('label');
          if(parentLabel && parentLabel.innerText) label = parentLabel.innerText.trim();
        }
        const required = !!el.required || (String(el.getAttribute('aria-required')||'').toLowerCase()==='true');
        const inputType = tag === 'input' ? (el.type || 'text') : tag;
        fields.push({ tag, id, name, label, placeholder, required, inputType });
      }
      const payload = { type:'form_fields_detected', url: location.href, fields };
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }catch(e){}
  }
  setTimeout(scanFormFields, 1600);
  setInterval(scanFormFields, 11000);
})(); true;
`;

export default function PortalScreen() {
  const params = useLocalSearchParams<{ url?: string; country?: string; visa_type?: string; stage?: string; objective?: string; form_type?: string; assistant?: string }>();
  const url = norm(params.url);
  const country = norm(params.country) || "unknown";
  const visaType = norm(params.visa_type) || "unknown";
  const stage = norm(params.stage) || "research";
  const objective = norm(params.objective) || "";
  const formType = norm(params.form_type) || "schengen_visa";
  const assistantDefaultOn = norm(params.assistant) === "1";

  const { state, upsertVisa, addPendingDetection, resolvePendingDetection } = useVisaTimeline();
  const visaIdRef = useRef<string | null>(null);
  const { profile } = useProfile();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingMsg, setPendingMsg] = useState<DetectedMsg | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [silentToast, setSilentToast] = useState<{ id: string; title: string } | null>(null);

  const [assistantOpen, setAssistantOpen] = useState(assistantDefaultOn);
  const [formsCat, setFormsCat] = useState<FormsCatalogResponse | null>(null);
  const [fieldsDetected, setFieldsDetected] = useState<Array<{ name?: string; id?: string; label?: string; placeholder?: string; required?: boolean; inputType?: string }> | null>(null);
  const [focusField, setFocusField] = useState<string>("");
  const [guidance, setGuidance] = useState<GuideFieldResponse | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [guidanceError, setGuidanceError] = useState<string | null>(null);

  const canOpen = useMemo(() => url.startsWith("http://") || url.startsWith("https://"), [url]);

  async function ensureVisaId() {
    if (visaIdRef.current) return visaIdRef.current;
    const id = await upsertVisa({ country, visaType, objective, stage: stage as any });
    visaIdRef.current = id;
    return id;
  }

  async function onDetected(raw: any) {
    let msg: DetectedMsg | null = null;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed?.type === "form_fields_detected") {
        const m = parsed as DetectedFieldMsg;
        const mapped = (m.fields || []).map((f) => ({
          name: norm(f.name),
          id: norm(f.id),
          label: norm(f.label),
          placeholder: norm(f.placeholder),
          required: !!f.required,
          inputType: norm(f.inputType),
        }));
        setFieldsDetected(mapped);
        return;
      }
      msg = parsed as DetectedMsg;
    } catch {
      return;
    }
    if (!msg || msg.type !== "date_detected") return;
    const visaId = await ensureVisaId();
    const id = await addPendingDetection({
      visaId,
      type: toVisaEventType(msg.eventType),
      title: `Date détectée: ${msg.title}`,
      dateIso: msg.dateIso,
      snippet: msg.snippet,
      sourceUrl: msg.url,
    });
    const silent = state.settings?.silentMode !== false;
    if (silent) {
      setSilentToast({ id, title: msg.title });
      // auto-hide toast
      setTimeout(() => setSilentToast(null), 4500);
      return;
    }
    setPendingId(id);
    setPendingMsg(msg);
    setEditDate(msg.dateIso || "");
  }

  useEffect(() => {
    (async () => {
      try {
        const cat = await Api.formsCatalog(formType);
        setFormsCat(cat);
      } catch {
        setFormsCat(null);
      }
    })();
  }, [formType]);

  const templateFields = useMemo(() => {
    const f = formsCat?.form?.fields || [];
    return f.map((x) => ({ name: String(x.name || ""), label: String(x.label || x.name || ""), required: !!x.required }));
  }, [formsCat?.form?.fields]);

  const assistantFields = useMemo(() => {
    // Sur web (iframe), pas de scan cross-origin → on utilise le template.
    if (Platform.OS === "web") return templateFields;
    const detected = fieldsDetected || [];
    if (!detected.length) return templateFields;

    // Merge: detected fields first; if empty names, fallback to template
    const out: Array<{ name: string; label: string; required: boolean }> = [];
    for (const d of detected) {
      const name = norm(d.name) || norm(d.id) || norm(d.label) || norm(d.placeholder);
      if (!name) continue;
      out.push({ name, label: norm(d.label) || name, required: !!d.required });
    }
    if (!out.length) return templateFields;
    return out.slice(0, 30);
  }, [fieldsDetected, templateFields]);

  async function loadGuidance(fieldName: string) {
    if (!profile) {
      setGuidanceError("Profil requis pour proposer des valeurs (onboarding).");
      setGuidance(null);
      return;
    }
    setGuidanceLoading(true);
    setGuidanceError(null);
    try {
      const g = await Api.guideField({
        profile,
        form_type: formType,
        field_name: fieldName,
        context: { country, visa_type: visaType, objective },
      });
      setGuidance(g);
    } catch (e: any) {
      setGuidanceError(String(e?.message || e));
      setGuidance(null);
    } finally {
      setGuidanceLoading(false);
    }
  }

  return (
    <Screen scroll={false}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Portail (suivi)</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {country.toUpperCase()} · {visaType} · stage: {stage}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            Form: {formType} · Assistant: {assistantOpen ? "ON" : "OFF"}
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          <PrimaryButton title={assistantOpen ? "Assistant: ON" : "Assistant: OFF"} variant="ghost" onPress={() => setAssistantOpen((v) => !v)} />
          <PrimaryButton title="Fermer" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>

      {!canOpen ? (
        <GlassCard>
          <Text style={styles.err}>URL invalide.</Text>
          <Text style={styles.sub}>Exemple: https://…</Text>
        </GlassCard>
      ) : Platform.OS === "web" ? (
        <View style={styles.webWrap}>
          <iframe title="portal" src={url} style={{ width: "100%", height: "100%", border: "none", borderRadius: 18 }} />
        </View>
      ) : (
        <View style={styles.webWrap}>
          <NativeWebView
            source={{ uri: url }}
            injectedJavaScript={INJECTED}
            onMessage={(e: any) => onDetected(e?.nativeEvent?.data)}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
          />
        </View>
      )}

      {assistantOpen ? (
        <View style={styles.assistantPanel}>
          <GlassCard style={styles.assistantCard}>
            <Text style={styles.cardTitle}>Assistant formulaire</Text>
            <Text style={styles.body}>
              Sélectionnez un champ pour voir une explication + une valeur proposée. Conseil: copiez/collez manuellement dans le portail.
            </Text>
            {Platform.OS === "web" ? (
              <Text style={styles.hint}>Sur web, l’inspection automatique des champs du site n’est pas possible (iframe). On utilise le template.</Text>
            ) : null}

            <View style={{ height: Tokens.space.sm }} />
            <Text style={styles.label}>Champ</Text>
            <TextInput
              value={focusField}
              onChangeText={setFocusField}
              placeholder="Ex: nationality"
              placeholderTextColor="rgba(16,22,47,0.35)"
              style={styles.input}
            />
            <View style={styles.row3}>
              <PrimaryButton
                title="Charger l’aide"
                onPress={async () => {
                  const x = focusField.trim();
                  if (!x) return;
                  await loadGuidance(x);
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Template"
                variant="ghost"
                onPress={() => {
                  const first = assistantFields[0]?.name || "";
                  setFocusField(first);
                  if (first) void loadGuidance(first);
                }}
                style={{ flex: 1 }}
              />
            </View>

            <View style={{ height: Tokens.space.md }} />
            <Text style={styles.smallTitle}>Champs suggérés</Text>
            <View style={styles.row3}>
              {assistantFields.slice(0, 8).map((f) => (
                <PrimaryButton
                  key={f.name}
                  title={f.required ? `${f.label} *` : f.label}
                  variant={focusField.trim() === f.name ? "brand" : "ghost"}
                  onPress={() => {
                    setFocusField(f.name);
                    void loadGuidance(f.name);
                  }}
                  style={{ flex: 1 }}
                />
              ))}
            </View>

            <View style={{ height: Tokens.space.md }} />
            {guidanceLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Chargement…</Text>
              </View>
            ) : guidanceError ? (
              <Text style={styles.err}>{guidanceError}</Text>
            ) : guidance ? (
              <>
                <Text style={styles.smallTitle}>Explication</Text>
                <Text style={styles.body}>{guidance.explanation}</Text>
                {guidance.suggested_value ? (
                  <>
                    <View style={{ height: Tokens.space.sm }} />
                    <Text style={styles.smallTitle}>Valeur proposée</Text>
                    <TextInput value={guidance.suggested_value} editable={false} style={styles.input} />
                    <View style={styles.row3}>
                      <PrimaryButton
                        title="Copier"
                        onPress={async () => {
                          if (!guidance.suggested_value) return;
                          await Clipboard.setStringAsync(String(guidance.suggested_value));
                        }}
                        style={{ flex: 1 }}
                      />
                      <PrimaryButton title="Pourquoi" variant="ghost" onPress={() => {}} style={{ flex: 1 }} />
                    </View>
                  </>
                ) : (
                  <Text style={styles.hint}>Aucune valeur proposée (souvent: besoin du passeport exact/OCR).</Text>
                )}

                {(guidance.consistency_checks || []).length ? (
                  <>
                    <View style={{ height: Tokens.space.sm }} />
                    <Text style={styles.smallTitle}>Checks</Text>
                    {(guidance.consistency_checks || []).slice(0, 6).map((x) => (
                      <Text key={x} style={styles.hint}>
                        - {x}
                      </Text>
                    ))}
                  </>
                ) : null}
                {(guidance.warnings || []).length ? (
                  <>
                    <View style={{ height: Tokens.space.sm }} />
                    <Text style={styles.smallTitle}>Alertes</Text>
                    {(guidance.warnings || []).slice(0, 3).map((x) => (
                      <Text key={x} style={[styles.hint, { color: Colors.warning }]}>
                        - {x}
                      </Text>
                    ))}
                  </>
                ) : null}
              </>
            ) : (
              <Text style={styles.hint}>Sélectionnez un champ pour démarrer.</Text>
            )}
          </GlassCard>
        </View>
      ) : null}

      {pendingId && pendingMsg ? (
        <View style={styles.overlay}>
          <GlassCard style={styles.overlayCard}>
            <Text style={styles.cardTitle}>Date détectée</Text>
            <Text style={styles.body}>
              Nous avons trouvé une date potentiellement importante liée à votre visa.
            </Text>
            <View style={{ height: Tokens.space.sm }} />
            <Text style={styles.k}>
              Type: <Text style={styles.v}>{pendingMsg.eventType}</Text>
            </Text>
            <Text style={styles.k}>
              Date: <Text style={styles.v}>{pendingMsg.dateIso || "— (à confirmer)"}</Text>
            </Text>
            {pendingMsg.snippet ? <Text style={styles.hint}>Extrait: {pendingMsg.snippet.slice(0, 140)}…</Text> : null}

            <View style={{ height: Tokens.space.md }} />
            <Text style={styles.label}>Modifier (si besoin)</Text>
            <TextInput value={editDate} onChangeText={setEditDate} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="rgba(16,22,47,0.35)" />

            <View style={{ height: Tokens.space.md }} />
            <Text style={styles.body}>
              “Nous avons trouvé une date importante liée à votre {visaType}. Voulez-vous :”
            </Text>
            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.row3}>
              <PrimaryButton
                title="1) Sauver + rappels"
                onPress={async () => {
                  await resolvePendingDetection(pendingId, "save");
                  setPendingId(null);
                  setPendingMsg(null);
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="2) Éditer"
                variant="ghost"
                onPress={async () => {
                  await resolvePendingDetection(pendingId, "edit", { dateIso: editDate.trim() || undefined });
                  setPendingId(null);
                  setPendingMsg(null);
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="3) Ignorer"
                variant="ghost"
                onPress={async () => {
                  await resolvePendingDetection(pendingId, "ignore");
                  setPendingId(null);
                  setPendingMsg(null);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </View>
      ) : null}

      {silentToast ? (
        <View style={styles.toast}>
          <GlassCard style={styles.toastCard}>
            <Text style={styles.body}>Date détectée: {silentToast.title}</Text>
            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.row3}>
              <PrimaryButton
                title="Revoir"
                variant="ghost"
                onPress={() => {
                  router.push("/(tabs)/appointments");
                  setSilentToast(null);
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Valider maintenant"
                onPress={async () => {
                  // open confirmation overlay for this pending
                  setPendingId(silentToast.id);
                  setPendingMsg({
                    type: "date_detected",
                    url,
                    eventType: "other",
                    title: silentToast.title,
                    dateIso: "",
                  });
                  setEditDate("");
                  setSilentToast(null);
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Ignorer"
                variant="ghost"
                onPress={async () => {
                  await resolvePendingDetection(silentToast.id, "ignore");
                  setSilentToast(null);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: Tokens.space.xl, paddingBottom: Tokens.space.md },
  h1: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.black },
  sub: { color: Colors.muted, fontSize: Tokens.font.size.sm, marginTop: 4 },
  webWrap: { flex: 1, marginHorizontal: Tokens.space.xl, marginBottom: Tokens.space.xl, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: Tokens.space.xl },
  overlayCard: { paddingBottom: Tokens.space.lg },
  toast: { position: "absolute", left: 0, right: 0, bottom: 0, padding: Tokens.space.xl },
  toastCard: { paddingBottom: Tokens.space.md },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  hint: { marginTop: Tokens.space.sm, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  k: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm },
  v: { color: Colors.text, fontWeight: Tokens.font.weight.semibold },
  row3: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  label: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.medium },
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
  err: { color: Colors.danger, fontSize: Tokens.font.size.md, lineHeight: 22 },
  assistantPanel: { position: "absolute", left: 0, right: 0, top: 86, bottom: 0, padding: Tokens.space.xl, pointerEvents: "box-none" },
  assistantCard: { maxHeight: "92%" as any },
  smallTitle: { marginTop: Tokens.space.sm, color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: Tokens.space.sm },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
});

