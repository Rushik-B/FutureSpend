"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  type SankeyNode as D3SankeyNode,
  type SankeyLink as D3SankeyLink,
} from "d3-sankey";
import type { SankeyData } from "@/lib/sankey";

// ── Visual constants (matching Sure's implementation) ─────────

const NODE_WIDTH = 15;
const NODE_PADDING = 20;
const MIN_NODE_PADDING = 4;
const MAX_PADDING_RATIO = 0.4;
const EXTENT_MARGIN = 16;
const CORNER_RADIUS = 8;
const HOVER_OPACITY = 0.4;
const HOVER_FILTER = "saturate(1.3) brightness(1.1)";
const MIN_LABEL_SPACING = 28;
const DEFAULT_COLOR = "#9E9E9E";

const CSS_VAR_MAP: Record<string, string> = {
  "var(--color-success)": "#10A861",
  "var(--color-destructive)": "#EC2222",
  "var(--color-gray-400)": "#9E9E9E",
  "var(--color-gray-500)": "#737373",
};

// ── Types ─────────────────────────────────────────────────────

interface NodeExtra {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface LinkExtra {
  color: string;
  percentage: number;
}

type SNode = D3SankeyNode<NodeExtra, LinkExtra>;
type SLink = D3SankeyLink<NodeExtra, LinkExtra>;

// ── Props ─────────────────────────────────────────────────────

interface CashflowSankeyProps {
  data: SankeyData;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────

export function CashflowSankey({ data, className }: CashflowSankeyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Drawing logic ─────────────────────────────────────────

  const draw = useCallback(() => {
    const el = containerRef.current;
    if (!el || !data.nodes.length || !data.links.length) return;

    const { width, height } = dimensions;
    if (width === 0 || height === 0) return;

    // Clear previous
    d3.select(el).selectAll("svg").remove();

    // Create tooltip if needed
    if (!tooltipRef.current) {
      const tip = document.createElement("div");
      tip.className =
        "sankey-tooltip fixed z-50 pointer-events-none px-3 py-2 rounded-lg text-xs font-medium";
      tip.style.cssText =
        "opacity:0;background:#1c1c20;border:1px solid rgba(255,255,255,0.08);color:#e4e4e7;box-shadow:0 8px 30px rgba(0,0,0,0.5);font-family:var(--font-sans);transition:opacity 0.1s ease;";
      document.body.appendChild(tip);
      tooltipRef.current = tip;
    }

    const svg = d3
      .select(el)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // Dynamic padding
    const nodeCount = data.nodes.length;
    const availableHeight = height - EXTENT_MARGIN * 2;
    const maxPaddingTotal = availableHeight * MAX_PADDING_RATIO;
    const gaps = Math.max(nodeCount - 1, 1);
    const dynamicPadding = Math.min(
      NODE_PADDING,
      Math.floor(maxPaddingTotal / gaps)
    );
    const effectivePadding = Math.max(MIN_NODE_PADDING, dynamicPadding);

    // Generate sankey layout
    const sankeyGenerator = d3Sankey<NodeExtra, LinkExtra>()
      .nodeWidth(NODE_WIDTH)
      .nodePadding(effectivePadding)
      .extent([
        [EXTENT_MARGIN, EXTENT_MARGIN],
        [width - EXTENT_MARGIN, height - EXTENT_MARGIN],
      ]);

    const sankeyData = sankeyGenerator({
      nodes: data.nodes.map((d) => ({ ...d })),
      links: data.links.map((d) => ({ ...d })),
    });

    // ── Gradients ──
    const defs = svg.append("defs");
    sankeyData.links.forEach((link, i) => {
      const gradientId = `link-gradient-${(link.source as SNode).index}-${(link.target as SNode).index}-${i}`;
      const gradient = defs
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", (link.source as SNode).x1!)
        .attr("x2", (link.target as SNode).x0!);

      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr(
          "stop-color",
          colorWithOpacity((link.source as SNode).color, 0.1)
        );

      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr(
          "stop-color",
          colorWithOpacity((link.target as SNode).color, 0.1)
        );
    });

    // ── Links ──
    const linkPaths = svg
      .append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(sankeyData.links)
      .join("path")
      .attr("class", "sankey-link")
      .attr("d", sankeyLinkHorizontal())
      .attr(
        "stroke",
        (d, i) =>
          `url(#link-gradient-${(d.source as SNode).index}-${(d.target as SNode).index}-${i})`
      )
      .attr("stroke-width", (d) => Math.max(1, d.width ?? 0))
      .style("transition", "opacity 0.3s ease, filter 0.3s ease");

    // ── Nodes ──
    const nodeGroups = svg
      .append("g")
      .selectAll("g")
      .data(sankeyData.nodes)
      .join("g")
      .style("transition", "opacity 0.3s ease");

    nodeGroups
      .append("path")
      .attr("d", (d) => nodePath(d as SNode))
      .attr("fill", (d) => d.color || DEFAULT_COLOR)
      .attr("stroke", (d) => (d.color ? "none" : "#737373"));

    // ── Labels ──
    const hiddenLabels = calculateHiddenLabels(
      sankeyData.nodes as SNode[],
      height
    );
    const currencySymbol = data.currencySymbol || "$";

    nodeGroups
      .append("text")
      .attr("x", (d) =>
        d.x0! < width / 2 ? d.x1! + 6 : d.x0! - 6
      )
      .attr("y", (d) => (d.y1! + d.y0!) / 2)
      .attr("dy", "-0.2em")
      .attr("text-anchor", (d) =>
        d.x0! < width / 2 ? "start" : "end"
      )
      .attr("class", "text-xs font-medium fill-current select-none")
      .style("fill", "#fafafa")
      .style("cursor", "default")
      .style("opacity", (d) => (hiddenLabels.has(d.index!) ? 0 : 1))
      .style("transition", "opacity 0.2s ease")
      .each(function (d) {
        const textEl = d3.select(this);
        textEl.selectAll("tspan").remove();

        textEl.append("tspan").text(d.name);

        textEl
          .append("tspan")
          .attr("x", textEl.attr("x"))
          .attr("dy", "1.2em")
          .style("fill", "#a1a1aa")
          .style("font-size", "0.65rem")
          .style("font-family", "var(--font-mono)")
          .text(formatCurrency(d.value!, currencySymbol));
      });

    // ── Hover events ──
    const applyHover = (targetLinks: Set<SLink>) => {
      const connectedNodes = new Set<SNode>();
      targetLinks.forEach((l) => {
        connectedNodes.add(l.source as SNode);
        connectedNodes.add(l.target as SNode);
      });

      linkPaths
        .style("opacity", (d) =>
          targetLinks.has(d as SLink) ? 1 : HOVER_OPACITY
        )
        .style("filter", (d) =>
          targetLinks.has(d as SLink) ? HOVER_FILTER : "none"
        );

      nodeGroups.style("opacity", (d) =>
        connectedNodes.has(d as SNode) ? 1 : HOVER_OPACITY
      );

      nodeGroups.selectAll("text").style("opacity", (d) => {
        const node = d as SNode;
        if (connectedNodes.has(node)) return 1;
        return hiddenLabels.has(node.index!) ? 0 : HOVER_OPACITY;
      });
    };

    const resetHover = () => {
      linkPaths.style("opacity", 1).style("filter", "none");
      nodeGroups.style("opacity", 1);
      nodeGroups
        .selectAll("text")
        .style("opacity", (d) =>
          hiddenLabels.has((d as SNode).index!) ? 0 : 1
        );
    };

    const showTooltip = (
      event: MouseEvent,
      value: number,
      percentage: number,
      title?: string
    ) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      const content = title
        ? `<strong>${title}</strong><br/>${formatCurrency(value, currencySymbol)} (${percentage || 0}%)`
        : `${formatCurrency(value, currencySymbol)} (${percentage || 0}%)`;
      tip.innerHTML = content;
      tip.style.left = `${event.clientX + 10}px`;
      tip.style.top = `${event.clientY - 10}px`;
      tip.style.opacity = "1";
    };

    const moveTooltip = (event: MouseEvent) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      tip.style.left = `${event.clientX + 10}px`;
      tip.style.top = `${event.clientY - 10}px`;
    };

    const hideTooltip = () => {
      const tip = tooltipRef.current;
      if (!tip) return;
      tip.style.opacity = "0";
    };

    // Link events
    linkPaths
      .on("mouseenter", (event, d) => {
        applyHover(new Set([d as SLink]));
        showTooltip(event, d.value, (d as SLink).percentage);
      })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => {
        resetHover();
        hideTooltip();
      });

    // Node events
    nodeGroups
      .selectAll("path")
      .style("cursor", "default")
      .on("mouseenter", (event, d) => {
        const node = d as SNode;
        const connected = new Set(
          sankeyData.links.filter(
            (l) =>
              (l.source as SNode) === node || (l.target as SNode) === node
          ) as SLink[]
        );
        applyHover(connected);
        showTooltip(event, node.value!, node.percentage, node.name);
      })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => {
        resetHover();
        hideTooltip();
      });

    nodeGroups
      .selectAll("text")
      .on("mouseenter", (event, d) => {
        const node = d as SNode;
        const connected = new Set(
          sankeyData.links.filter(
            (l) =>
              (l.source as SNode) === node || (l.target as SNode) === node
          ) as SLink[]
        );
        applyHover(connected);
        showTooltip(event, node.value!, node.percentage, node.name);
      })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => {
        resetHover();
        hideTooltip();
      });
  }, [data, dimensions]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Cleanup tooltip on unmount
  useEffect(() => {
    return () => {
      tooltipRef.current?.remove();
      tooltipRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className ?? "w-full h-full"}
    />
  );
}

// ── Helpers (ported from Sure's sankey_chart_controller) ──────

function colorWithOpacity(nodeColor: string, opacity = 0.1): string {
  let colorStr = nodeColor || DEFAULT_COLOR;
  colorStr = CSS_VAR_MAP[colorStr] || colorStr;
  if (colorStr.startsWith("var(--")) return colorStr;
  const d3Color = d3.color(colorStr);
  if (d3Color) {
    d3Color.opacity = opacity;
    return d3Color.formatRgb();
  }
  return DEFAULT_COLOR;
}

function nodePath(node: SNode): string {
  const { x0, y0, x1, y1 } = node;
  if (x0 == null || y0 == null || x1 == null || y1 == null) return "";
  const height = y1 - y0;
  const radius = Math.max(0, Math.min(CORNER_RADIUS, height / 2));

  const isSource =
    (node.sourceLinks?.length ?? 0) > 0 && !node.targetLinks?.length;
  const isTarget =
    (node.targetLinks?.length ?? 0) > 0 && !node.sourceLinks?.length;

  if (height < radius * 2) return rectPath(x0, y0, x1, y1);
  if (isSource) return roundedLeftPath(x0, y0, x1, y1, radius);
  if (isTarget) return roundedRightPath(x0, y0, x1, y1, radius);
  return rectPath(x0, y0, x1, y1);
}

function rectPath(x0: number, y0: number, x1: number, y1: number) {
  return `M ${x0},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0},${y1} Z`;
}

function roundedLeftPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number
) {
  return `M ${x0 + r},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0 + r},${y1} Q ${x0},${y1} ${x0},${y1 - r} L ${x0},${y0 + r} Q ${x0},${y0} ${x0 + r},${y0} Z`;
}

function roundedRightPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number
) {
  return `M ${x0},${y0} L ${x1 - r},${y0} Q ${x1},${y0} ${x1},${y0 + r} L ${x1},${y1 - r} Q ${x1},${y1} ${x1 - r},${y1} L ${x0},${y1} Z`;
}

function calculateHiddenLabels(
  nodes: SNode[],
  containerHeight: number
): Set<number> {
  const hidden = new Set<number>();
  const isLarge = containerHeight > 600;
  const minSpacing = isLarge
    ? MIN_LABEL_SPACING * 0.7
    : MIN_LABEL_SPACING;

  const columns = new Map<number, SNode[]>();
  nodes.forEach((node) => {
    const depth = node.depth ?? 0;
    if (!columns.has(depth)) columns.set(depth, []);
    columns.get(depth)!.push(node);
  });

  columns.forEach((colNodes) => {
    colNodes.sort((a, b) => (a.y0! + a.y1!) / 2 - (b.y0! + b.y1!) / 2);
    let lastVisibleY = Number.NEGATIVE_INFINITY;
    colNodes.forEach((node) => {
      const nodeY = (node.y0! + node.y1!) / 2;
      const nodeHeight = node.y1! - node.y0!;
      if (isLarge && nodeHeight > minSpacing * 1.5) {
        lastVisibleY = nodeY;
      } else if (nodeY - lastVisibleY < minSpacing) {
        hidden.add(node.index!);
      } else {
        lastVisibleY = nodeY;
      }
    });
  });

  return hidden;
}

function formatCurrency(value: number, symbol: string): string {
  const formatted = Number.parseFloat(String(value)).toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );
  return symbol + formatted;
}
