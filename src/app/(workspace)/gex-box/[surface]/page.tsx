import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ surface: string }> };

const GEX_BOX_SURFACES = ["classic", "state", "orderflow", "research"] as const;
type GexBoxSurface = (typeof GEX_BOX_SURFACES)[number];

function isGexBoxSurface(surface: string): surface is GexBoxSurface {
  return GEX_BOX_SURFACES.some((candidate) => candidate === surface);
}

export function generateStaticParams() {
  return GEX_BOX_SURFACES.map((surface) => ({ surface }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { surface } = await params;
  if (!isGexBoxSurface(surface)) return {};
  const label = surface.replaceAll("-", " ").toUpperCase();
  return {
    title: `${label} · GEX BOX · KwantDesk`,
    description: "Classic, state, order-flow and research options-exposure workstation.",
  };
}

export default async function GexBoxSurfacePage({ params }: Props) {
  const { surface } = await params;
  if (!isGexBoxSurface(surface)) notFound();
  return null;
}
