"use client";

import type { AnalyzeResult } from "@/lib/types";
import { useState } from "react";

type ResultPanelProps = {
  loading: boolean;
  error: string | null;
  result: AnalyzeResult | null;
};

const ANALYSIS_LABELS: { key: keyof AnalyzeResult["analysis"]; label: string }[] = [
  { key: "subject", label: "主体" },
  { key: "style", label: "风格" },
  { key: "composition", label: "构图" },
  { key: "lighting", label: "光影" },
  { key: "colors", label: "色彩" },
  { key: "atmosphere", label: "氛围" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:border-cinnabar hover:text-cinnabar"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}

export function ResultPanel({ loading, error, result }: ResultPanelProps) {
  if (loading) {
    return (
      <section className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-line bg-card/90 p-8 text-center">
        <span className="seal ink-pulse">推</span>
        <p className="mt-5 font-serif text-2xl">正在看图，反推提示词</p>
        <p className="mt-2 text-sm text-muted">通常只要几秒</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-cinnabar/30 bg-card/90 p-6">
        <h2 className="font-serif text-2xl text-cinnabar">还没反推成功</h2>
        <p className="mt-3 text-sm leading-7 text-ink-soft">{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="rounded-3xl border border-line bg-card/90 p-6">
        <h2 className="font-serif text-2xl">提示词会出在这里</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          先上传一张图，选好输出风格，再点「反推提示词」。结果会包含中文说明、英文提示词，以及主体、光影等拆解。
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <article className="rounded-3xl border border-line bg-card/90 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">中文提示词</h2>
          <CopyButton text={result.prompt} />
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-soft">{result.prompt}</p>
      </article>

      {result.promptEn ? (
        <article className="rounded-3xl border border-line bg-card/90 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">英文提示词</h2>
            <CopyButton text={result.promptEn} />
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-soft">{result.promptEn}</p>
        </article>
      ) : null}

      {result.negative ? (
        <article className="rounded-3xl border border-line bg-card/90 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">负面提示词</h2>
            <CopyButton text={result.negative} />
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-soft">{result.negative}</p>
        </article>
      ) : null}

      <article className="rounded-3xl border border-line bg-card/90 p-6">
        <h2 className="font-serif text-2xl">画面拆解</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {ANALYSIS_LABELS.map((item) => (
            <div key={item.key} className="rounded-2xl bg-paper px-4 py-3">
              <dt className="text-xs tracking-[0.2em] text-gold">{item.label}</dt>
              <dd className="mt-1 text-sm leading-6 text-ink-soft">{result.analysis[item.key] || "—"}</dd>
            </div>
          ))}
        </dl>
      </article>
    </section>
  );
}
