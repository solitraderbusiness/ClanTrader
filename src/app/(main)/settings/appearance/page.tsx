"use client";

import {
  useFontStore,
  EN_FONT_OPTIONS,
  FA_FONT_OPTIONS,
} from "@/stores/font-store";

const EN_PREVIEW = "The quick brown fox jumps over the lazy dog";
const FA_PREVIEW = "زیبایی در سادگی است";

export default function AppearancePage() {
  const { enFont, faFont, setEnFont, setFaFont } = useFontStore();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize fonts and display preferences.
        </p>
      </div>

      {/* English Fonts */}
      <section className="space-y-3">
        <h3 className="text-base font-medium">English Font</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {EN_FONT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setEnFont(opt.value)}
              className={`rounded-lg border-2 p-4 text-start transition-colors ${
                enFont === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p
                className="mt-2 text-[15px] leading-relaxed"
                style={{ fontFamily: `var(--font-${opt.value})` }}
              >
                {EN_PREVIEW}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Persian Fonts */}
      <section className="space-y-3">
        <h3 className="text-base font-medium">Persian Font (فونت فارسی)</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {FA_FONT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFaFont(opt.value)}
              className={`rounded-lg border-2 p-4 text-start transition-colors ${
                faFont === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <p className="text-sm font-medium">
                {opt.label} ({opt.labelFa})
              </p>
              <p
                className="mt-2 text-lg leading-relaxed"
                dir="rtl"
                style={{ fontFamily: `var(--font-${opt.value})` }}
              >
                {FA_PREVIEW}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
