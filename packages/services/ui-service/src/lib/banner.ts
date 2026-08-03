import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import type { CSSProperties } from "react";
import { z } from "zod";

import { getCompetitionBanner } from "./competition-data";

/** Which way round the header's ink runs. */
export type Tone = "light" | "dark";

/** A banner with the two facts the header needs settled. */
export type SampledBanner = { src: string; tone: Tone; ratio: number };

const getBanner = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(({ data: id }) => getCompetitionBanner(id));

/** Edge of the square the picture is squashed into before it is measured. */
const SAMPLE_EDGE = 48;

/**
 * The fraction of the picture's height a header actually shows. The crop is
 * centred, so this is the middle band, and it is the only part worth measuring:
 * a picture can be dark overall and bright across its middle, and it is the
 * middle the text has to sit on.
 */
const SHOWN_BAND = 0.5;

/**
 * Above this the picture counts as light and the header takes dark ink.
 *
 * In CIE L*, so 50 really is the middle. Turn it down to send more borderline
 * pictures to the dark treatment, which is the more forgiving of the two:
 * light ink survives a busy background better than dark ink does.
 */
const LIGHT_ABOVE = 50;

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Mean lightness of the sampled pixels, 0 to 100.
 *
 * Luminance is averaged first and converted after, and the conversion matters:
 * luminance is linear in light rather than in perception, and puts a mid grey
 * at 0.22, so thresholding it directly would call almost every picture dark.
 */
function lightnessOf(pixels: Uint8ClampedArray): number {
  let total = 0;
  let counted = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    total +=
      0.2126 * toLinear(pixels[i]) +
      0.7152 * toLinear(pixels[i + 1]) +
      0.0722 * toLinear(pixels[i + 2]);
    counted += 1;
  }

  const luminance = counted ? total / counted : 0;
  return luminance <= 0.008856 ?
      903.3 * luminance
    : 116 * Math.cbrt(luminance) - 16;
}

/** Whether the bytes are somebody else's to hand over. */
const isRemote = (src: string) => /^https?:/i.test(src);

function loadImage(src: string, readable: boolean): Promise<HTMLImageElement> {
  const image = new Image();
  // Asking for CORS on a host that does not offer it fails the load outright,
  // which is why this is a choice rather than something always switched on.
  if (readable) image.crossOrigin = "anonymous";
  image.src = src;
  return image.decode().then(() => image);
}

/** Throws for a picture the browser will not let us read back. */
function readMiddleBand(image: HTMLImageElement): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_EDGE;
  canvas.height = SAMPLE_EDGE;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d context");

  const bandHeight = image.naturalHeight * SHOWN_BAND;
  context.drawImage(
    image,
    0,
    (image.naturalHeight - bandHeight) / 2,
    image.naturalWidth,
    bandHeight,
    0,
    0,
    SAMPLE_EDGE,
    SAMPLE_EDGE,
  );

  return context.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE).data;
}

/**
 * Works out how the header should be drawn over this picture.
 *
 * Belongs at upload time, where the bytes are already on the server and neither
 * the cross-origin rules nor the wait apply. It is here because a banner can be
 * any URL an organiser writes, and there is no image decoder on the server to
 * read one with. The shape of the answer is the same either way, so moving it
 * later changes where `tone` and `ratio` are filled in and nothing else.
 *
 * A picture that cannot be read back is treated as dark, which puts light ink on
 * it. That is the safer of the two guesses: light ink stays legible over a busy
 * or mid-toned picture for longer than dark ink does.
 */
async function sampleBanner(src: string): Promise<SampledBanner> {
  // Permission is asked for only where it means something. A `data:` URL
  // carries its own bytes and is readable already, and asking anyway has been
  // known to fail loads that would otherwise have worked.
  let image = await loadImage(src, isRemote(src)).catch(() => undefined);
  let tone: Tone | undefined;

  if (image) {
    try {
      tone = lightnessOf(readMiddleBand(image)) > LIGHT_ABOVE ? "light" : "dark";
    } catch {
      // The host let the picture in and then tainted the canvas. Fall through
      // to the plain load, which still yields the shape.
      image = undefined;
    }
  }

  image ??= await loadImage(src, false);

  return {
    src,
    tone: tone ?? "dark",
    ratio: image.naturalWidth / image.naturalHeight,
  };
}

/**
 * The competition whose chrome this page is inside, if it is inside one.
 *
 * Read off the matched routes rather than passed down, which is what keeps the
 * navbar and the header band in agreement. They sit on opposite sides of the
 * shell and neither can be told by the other, but both are asking about the
 * same match and so cannot answer differently.
 */
function useBannerCompetition(): string | undefined {
  return useRouterState({
    select: (state) => {
      const match = state.matches.find(
        (match) => match.routeId === "/competitions/$id",
      );
      return (match?.params as { id?: string } | undefined)?.id;
    },
  });
}

/**
 * The banner for the competition being read, once it has arrived and been
 * measured.
 *
 * Absent until then, and absent for good for a competition that configured
 * none. The header holds its ordinary appearance and becomes a banner in one
 * step, rather than showing the picture under whichever ink the page happened to
 * be using and correcting itself a moment later. Cached against the competition
 * and never refetched, so it is measured once and every later visit is already
 * settled.
 */
export function useBanner(): SampledBanner | undefined {
  const competitionId = useBannerCompetition();
  const fetchBanner = useServerFn(getBanner);

  const { data } = useQuery({
    queryKey: ["banner", competitionId],
    queryFn: async () => {
      const src = await fetchBanner({ data: competitionId! });
      // `null` rather than `undefined`, which the cache reads as "nothing was
      // returned" and refetches. A competition with no banner has a settled
      // answer and should be asked once.
      return src ? await sampleBanner(src) : null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    enabled: competitionId !== undefined && typeof window !== "undefined",
  });

  return data ?? undefined;
}

/**
 * Whether the chrome around this page should be painted as a banner.
 *
 * The same question as `useBanner`, for the two halves of the chrome that need
 * the answer but not the picture. It goes through the same query, so a banner
 * cannot be half painted.
 */
export function useHasBanner(): boolean {
  return useBanner() !== undefined;
}

/**
 * What the header needs, handed to CSS.
 *
 * Published by the shell, which is the only element above both halves of the
 * chrome, and read back by each of them through inheritance. Nothing here is
 * re-declared on `.banner-chrome` under the same name: a declaration on an
 * element beats what it inherits, so a name used on both sides would mean the
 * published value never arrives. See `styles.css`.
 *
 * The tone is not here because it selects a palette rather than supplying a
 * value; it rides on a `data-banner-tone` attribute the stylesheet matches.
 */
export function bannerVars(banner: SampledBanner | undefined) {
  return banner ?
      ({
        "--banner-image": `url("${banner.src}")`,
        "--banner-ratio": String(banner.ratio),
      } as CSSProperties)
    : undefined;
}
