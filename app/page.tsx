"use client";

import { ResultPanel } from "@/components/ResultPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Uploader } from "@/components/Uploader";
import { fileToPayload } from "@/lib/image";
import { STYLE_OPTIONS } from "@/lib/prompts";
import { loadSettings, saveSettings, type ModelSettings } from "@/lib/settings";
import type { AnalyzeResult, PromptStyle } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [style, setStyle] = useState<PromptStyle>("bilingual");
  const [settings, setSettings] = useState<ModelSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function analyze() {
    if (!file) {
      setError("请先上传一张图片");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = await fileToPayload(file);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          style,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
        }),
      });
      const data = (await response.json()) as AnalyzeResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "反推失败");
      }
      setResult(data);
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "反推失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="seal">语</span>
            <div>
              <p className="text-xs tracking-[0.35em] text-gold">HUAYU</p>
              <h1 className="font-serif text-4xl sm:text-5xl">画语</h1>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted sm:text-base">
            上传一张图，把它反推成可直接使用的提示词。先做中文版，结果里也会带上英文，方便丢给各种文生图模型。
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-sm text-ink-soft hover:border-cinnabar hover:text-cinnabar"
          onClick={() => setSettingsOpen(true)}
        >
          设置
        </button>
      </header>

      <main className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-5">
          <Uploader
            previewUrl={previewUrl}
            fileName={file?.name ?? null}
            disabled={loading}
            onFile={(next) => {
              setFile(next);
              setResult(null);
              setError(null);
            }}
            onClear={() => {
              setFile(null);
              setResult(null);
              setError(null);
            }}
          />

          <section className="rounded-3xl border border-line bg-card/90 p-5">
            <h2 className="font-serif text-2xl">输出风格</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {STYLE_OPTIONS.map((option) => {
                const active = style === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setStyle(option.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-cinnabar bg-cinnabar/5 text-ink"
                        : "border-line bg-paper text-ink-soft hover:border-gold"
                    }`}
                  >
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-1 block text-xs text-muted">{option.hint}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={loading || !file}
              onClick={analyze}
              className="mt-5 w-full rounded-full bg-cinnabar py-3 text-sm text-white transition hover:bg-cinnabar-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
            >
              {loading ? "反推中…" : "反推提示词"}
            </button>
            {!settings.apiKey ? (
              <p className="mt-3 text-center text-xs leading-6 text-muted">
                还没填 API Key。点右上角「设置」，填入能看图的模型密钥后即可使用。
              </p>
            ) : null}
          </section>
        </div>

        <ResultPanel loading={loading} error={error} result={result} />
      </main>

      <footer className="mt-12 border-t border-line/70 pt-6 text-xs leading-6 text-muted">
        画语只做一件事：看图，写出提示词。Key 存在你的浏览器本地。以后要加历史记录、一键改风格，都可以继续往上长。
      </footer>

      <SettingsDialog
        open={settingsOpen}
        value={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => {
          setSettings(next);
          saveSettings(next);
        }}
      />
    </div>
  );
}
