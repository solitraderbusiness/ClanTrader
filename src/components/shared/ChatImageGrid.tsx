"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface ChatImageGridProps {
  images: string[];
}

export function ChatImageGrid({ images }: ChatImageGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  return (
    <>
      <div
        className={`mb-1 grid gap-1 ${
          images.length === 1
            ? "grid-cols-1"
            : "grid-cols-2"
        }`}
      >
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            className="overflow-hidden rounded-lg"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(i);
            }}
          >
            <img
              src={src}
              alt={`Image ${i + 1}`}
              className="w-full object-cover"
              style={{
                maxHeight: images.length === 1 ? 300 : 150,
              }}
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog
        open={lightboxIndex !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxIndex(null);
        }}
      >
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-black/90 [&>button]:hidden">
          {lightboxIndex !== null && (
            <div className="relative flex items-center justify-center">
              <img
                src={images[lightboxIndex]}
                alt={`Image ${lightboxIndex + 1}`}
                className="max-h-[85vh] max-w-full object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 end-2 text-white hover:bg-white/20"
                onClick={() => setLightboxIndex(null)}
              >
                <X className="h-5 w-5" />
              </Button>
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute start-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                    onClick={() =>
                      setLightboxIndex(
                        (lightboxIndex - 1 + images.length) % images.length
                      )
                    }
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute end-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                    onClick={() =>
                      setLightboxIndex((lightboxIndex + 1) % images.length)
                    }
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
