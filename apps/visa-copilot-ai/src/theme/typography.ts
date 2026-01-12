import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

import { Tokens } from "@/src/theme/tokens";

export type TypeScale = {
  h1: { fontSize: number; lineHeight: number; fontWeight: typeof Tokens.font.weight.black; letterSpacing?: number };
  h2: { fontSize: number; lineHeight: number; fontWeight: typeof Tokens.font.weight.black };
  h3: { fontSize: number; lineHeight: number; fontWeight: typeof Tokens.font.weight.bold };
  body: { fontSize: number; lineHeight: number; fontWeight: typeof Tokens.font.weight.medium };
  bodyStrong: { fontSize: number; lineHeight: number; fontWeight: typeof Tokens.font.weight.bold };
  caption: { fontSize: number; lineHeight: number; fontWeight: typeof Tokens.font.weight.semibold };
};

function roundLh(fontSize: number, ratio: number) {
  return Math.round(fontSize * ratio);
}

export function useTypeScale(): TypeScale {
  const { width } = useWindowDimensions();
  const isMobile = width < 720;

  return useMemo(() => {
    const h1 = isMobile ? 28 : 34;
    const h2 = isMobile ? 20 : 22;
    const h3 = 18;
    const body = 16;
    const caption = 12;

    return {
      h1: { fontSize: h1, lineHeight: roundLh(h1, 1.12), fontWeight: Tokens.font.weight.black, letterSpacing: 0.1 },
      h2: { fontSize: h2, lineHeight: roundLh(h2, 1.18), fontWeight: Tokens.font.weight.black },
      h3: { fontSize: h3, lineHeight: roundLh(h3, 1.2), fontWeight: Tokens.font.weight.bold },
      body: { fontSize: body, lineHeight: roundLh(body, 1.4), fontWeight: Tokens.font.weight.medium },
      bodyStrong: { fontSize: body, lineHeight: roundLh(body, 1.4), fontWeight: Tokens.font.weight.bold },
      caption: { fontSize: caption, lineHeight: roundLh(caption, 1.3), fontWeight: Tokens.font.weight.semibold },
    };
  }, [isMobile]);
}

