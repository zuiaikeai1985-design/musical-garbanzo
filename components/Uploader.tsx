"use client";

import { useRef, useState } from "react";

type UploaderProps = {
  previewUrl: string | null;
  fileName: string | null;
  disabled?: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
};

export function Uploader({ previewUrl, fileName, disabled, onFile, onClear }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function takeFile(file?: File) {
    if (!file || disabled) {
      return;
    }
    onFile(file);
  }

  return (
    <section className="rounded-3xl border border-line bg-card/90 p-5 shadow-[0_20px_60px_rgba(28,25,21,0.06)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl">上传图片</h2>
          <p className="mt-1 text-sm text-muted">支持拖拽，或直接点击选择</p>
        </div>
        {previewUrl ? (
          <button type="button" className="text-sm text-cinnabar hover:text-cinnabar-deep" onClick={onClear}>
            换一张
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          takeFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {previewUrl ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-paper-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={fileName || "已上传的图片"} className="max-h-[420px] w-full object-contain" />
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            takeFile(event.dataTransfer.files?.[0]);
          }}
          className={`dropzone mt-5 flex min-h-[280px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition ${
            dragging ? "border-cinnabar bg-cinnabar/5" : "border-line bg-paper"
          }`}
        >
          <span className="seal">画</span>
          <p className="mt-5 font-serif text-xl text-ink">把图片拖到这里</p>
          <p className="mt-2 text-sm text-muted">JPG / PNG / WebP，最大 8MB</p>
        </button>
      )}
    </section>
  );
}
