import React, { useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useVisaTimeline } from "@/src/state/visa_timeline";

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
})(); true;
`;

export default function PortalScreen() {
  const params = useLocalSearchParams<{ url?: string; country?: string; visa_type?: string; stage?: string; objective?: string }>();
  const url = norm(params.url);
  const country = norm(params.country) || "unknown";
  const visaType = norm(params.visa_type) || "unknown";
  const stage = norm(params.stage) || "research";
  const objective = norm(params.objective) || "";

  const { upsertVisa, addPendingDetection, resolvePendingDetection } = useVisaTimeline();
  const visaIdRef = useRef<string | null>(null);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingMsg, setPendingMsg] = useState<DetectedMsg | null>(null);
  const [editDate, setEditDate] = useState<string>("");

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
      msg = typeof raw === "string" ? (JSON.parse(raw) as DetectedMsg) : (raw as DetectedMsg);
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
    setPendingId(id);
    setPendingMsg(msg);
    setEditDate(msg.dateIso || "");
  }

  return (
    <Screen scroll={false}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Portail (suivi)</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {country.toUpperCase()} · {visaType} · stage: {stage}
          </Text>
        </View>
        <PrimaryButton title="Fermer" variant="ghost" onPress={() => router.back()} />
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
});

