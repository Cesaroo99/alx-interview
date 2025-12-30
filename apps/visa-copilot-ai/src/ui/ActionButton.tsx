import React from "react";
import { StyleProp, ViewStyle } from "react-native";

import { Api } from "@/src/api/client";
import { useDocuments } from "@/src/state/documents";
import { useJourney } from "@/src/state/journey";
import { useProfile } from "@/src/state/profile";
import { buildJourneyContext } from "@/src/telemetry/journeyContext";
import { PrimaryButton } from "@/src/ui/PrimaryButton";

export type TrackAction = {
  type: string;
  label: string;
  screen?: string;
  target?: string | null;
  meta?: Record<string, any>;
};

export function ActionButton({
  title,
  onPress,
  style,
  variant = "brand",
  track,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
  variant?: "brand" | "danger" | "ghost";
  track?: TrackAction;
}) {
  const { profile } = useProfile();
  const { docs } = useDocuments();
  const { activeJourneyId, locale } = useJourney();

  return (
    <PrimaryButton
      title={title}
      variant={variant}
      style={style}
      onPress={async () => {
        // Best-effort tracking. Ne bloque jamais l’action utilisateur.
        if (activeJourneyId && track) {
          Api.journeyAct({
            journey_id: activeJourneyId,
            locale,
            context: buildJourneyContext(profile, docs),
            action: {
              type: track.type,
              label: track.label,
              screen: track.screen || null,
              target: track.target || null,
              meta: track.meta || null,
            },
          }).catch(() => undefined);
        }

        await onPress();
      }}
    />
  );
}

