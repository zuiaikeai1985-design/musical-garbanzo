"use client";

import { DEFAULT_SETTINGS, type ModelSettings } from "@/lib/settings";
import { useEffect, useState } from "react";

type SettingsDialogProps = {
  open: boolean;
  value: ModelSettings;
  onClose: () => void;
  onSave: (next: ModelSettings) => void;
};

const PRESETS = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { label: "硅基流动", baseUrl: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-VL-32B-Instruct" },
  { label: "通义", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-vl-plus" },
];

export function SettingsDialog({ open, value, onClose, onSave }: SettingsDialogProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <button className="absolute inset-0 cursor-default" aria-label="关闭设置" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-card p-6 shadow-2xl">
        <p className="font-serif text-2xl text-ink">设置</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          反推需要一个能看图的模型。Key 只保存在你这台电脑的浏览器里，不会上传到我们的服务器做存储。
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:border-cinnabar hover:text-cinnabar"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  baseUrl: preset.baseUrl,
                  model: preset.model,
                }))
              }
            >
              {preset.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-sm text-ink-soft">
          API Key
          <input
            type="password"
            autoComplete="off"
            value={draft.apiKey}
            onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none focus:border-cinnabar"
            placeholder="sk-..."
          />
        </label>

        <label className="mt-4 block text-sm text-ink-soft">
          接口地址
          <input
            value={draft.baseUrl}
            onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none focus:border-cinnabar"
          />
        </label>

        <label className="mt-4 block text-sm text-ink-soft">
          模型名称
          <input
            value={draft.model}
            onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none focus:border-cinnabar"
          />
        </label>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-sm text-muted hover:text-ink"
            onClick={() => setDraft(DEFAULT_SETTINGS)}
          >
            恢复默认
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-full bg-cinnabar px-4 py-2 text-sm text-white hover:bg-cinnabar-deep"
              onClick={() => {
                onSave(draft);
                onClose();
              }}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
