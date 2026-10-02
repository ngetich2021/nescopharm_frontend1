import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect } from "react";
import React from "react"; // Import React

export function ImagePreview({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev,
}: {
  images: { url: string; caption?: string }[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  if (currentIndex < 0 || currentIndex >= images.length) {
    if (images.length > 0) currentIndex = 0;
    else return null;
  }
  const currentImage = images[currentIndex];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (images.length > 1) {
        if (e.key === "ArrowRight") onNext();
        if (e.key === "ArrowLeft") onPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrev, images.length]);

  if (!currentImage) {
    onClose();
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-preview-caption"
    >
      {/* Main content container */}
      <div className="relative h-full w-full flex flex-col max-w-screen-xl max-h-screen">
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
          <div className="text-white/80 text-sm bg-black/50 px-2 py-1 rounded">
            {currentIndex + 1} / {images.length}
          </div>

          <button
            onClick={onClose}
            className="text-white p-2 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close image preview"
          >
            <X size={28} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center relative min-h-0">
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              disabled={currentIndex === 0}
              className={`absolute left-0 top-1/2 -translate-y-1/2 text-white p-4 hover:bg-white/10 transition-colors z-20 ${
                currentIndex === images.length - 1
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              aria-label="Previous image"
            >
              <ChevronLeft size={32} />
            </button>
          )}
          <img
            src={currentImage.url}
            alt={currentImage.caption || `Image preview ${currentIndex + 1}`}
            className="max-h-full max-w-full object-contain block"
            style={{ maxHeight: "calc(100vh - 100px)" }}
          />
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              disabled={currentIndex === images.length - 1}
              className={`absolute right-4 text-white p-3 rounded-full hover:bg-white/20 transition-colors z-20 ${
                currentIndex === images.length - 1
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              aria-label="Next image"
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
        {currentImage.caption && (
          <div className="absolute bottom-0 left-0 right-0 p-4 pt-10 bg-gradient-to-t from-black/80 to-transparent text-center flex justify-center items-center z-10">
            <div className="flex justify-between items-center w-full max-w-screen-md">
              {currentImage.caption && (
                <p
                  id="image-preview-caption"
                  className="text-white/90 text-sm text-left mr-4 flex-1"
                >
                  {currentImage.caption}
                </p>
              )}
              <a
                href={currentImage.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="text-white flex-shrink-0 flex items-center gap-2 p-2 hover:bg-white/20 rounded transition-colors"
                onClick={(e) => e.stopPropagation()}
                aria-label="Download image"
              >
                <Download size={20} />
                <span className="hidden sm:inline text-sm">Download</span>{" "}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
