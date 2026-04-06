'use client';

import { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';

export function ImageCarousel({ images = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  // Filter out empty/null images
  const validImages = images.filter(
    (img) => img && typeof img === 'string' && img.trim().length > 0
  );

  if (!validImages || validImages.length === 0) {
    return null;
  }

  useEffect(() => {
    if (!isAutoPlay || validImages.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % validImages.length);
    }, 5000); // Auto-play every 5 seconds

    return () => clearInterval(timer);
  }, [isAutoPlay, validImages.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? validImages.length - 1 : prev - 1
    );
    setIsAutoPlay(false);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
    setIsAutoPlay(false);
  };

  const handleDotClick = (index) => {
    setCurrentIndex(index);
    setIsAutoPlay(false);
  };

  const isSingleImage = validImages.length === 1;

  return (
    <div className="ic-container">
      {/* Main Image */}
      <div className="ic-image-wrapper">
        <img
          src={validImages[currentIndex]}
          alt={`Carousel image ${currentIndex + 1}`}
          className="ic-image"
        />

        {/* Image Count Badge */}
        <div className="ic-badge">
          {currentIndex + 1} / {validImages.length}
        </div>

        {/* Navigation Arrows (only show if multiple images) */}
        {!isSingleImage && (
          <>
            <button
              onClick={handlePrev}
              className="ic-nav ic-nav-prev"
              aria-label="Previous image"
              type="button"
            >
              <ChevronLeftIcon className="ic-nav-icon" />
            </button>
            <button
              onClick={handleNext}
              className="ic-nav ic-nav-next"
              aria-label="Next image"
              type="button"
            >
              <ChevronRightIcon className="ic-nav-icon" />
            </button>
          </>
        )}
      </div>

      {/* Navigation Dots (only show if multiple images) */}
      {!isSingleImage && (
        <div className="ic-dots">
          {validImages.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={`ic-dot ${index === currentIndex ? 'ic-dot-active' : ''}`}
              aria-label={`Go to image ${index + 1}`}
              type="button"
            />
          ))}
        </div>
      )}

      <style>{`
        .ic-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .ic-image-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 0.75rem;
          overflow: hidden;
          background: #0a0a12;
          border: 1px solid #1a1a2a;
        }

        .ic-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* Badge */
        .ic-badge {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          background: rgba(10, 10, 18, 0.8);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #a0a0b0;
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          font-family: 'DM Mono', monospace;
        }

        /* Navigation Arrows */
        .ic-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(10, 10, 18, 0.6);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #a0a0b0;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
          z-index: 10;
        }

        .ic-nav:hover {
          background: rgba(10, 10, 18, 0.9);
          border-color: rgba(255, 255, 255, 0.2);
          color: #f0f0f8;
        }

        .ic-nav-prev {
          left: 0.75rem;
        }

        .ic-nav-next {
          right: 0.75rem;
        }

        .ic-nav-icon {
          width: 1.25rem;
          height: 1.25rem;
        }

        /* Dots */
        .ic-dots {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .ic-dot {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 50%;
          background: rgba(160, 160, 176, 0.3);
          border: 1px solid rgba(160, 160, 176, 0.5);
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }

        .ic-dot:hover {
          background: rgba(160, 160, 176, 0.5);
          border-color: rgba(160, 160, 176, 0.7);
        }

        .ic-dot-active {
          background: #818cf8;
          border-color: #6366f1;
        }

        /* Mobile optimizations */
        @media (max-width: 640px) {
          .ic-image-wrapper {
            aspect-ratio: 4 / 3;
          }

          .ic-badge {
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
            top: 0.5rem;
            right: 0.5rem;
          }

          .ic-nav {
            width: 2rem;
            height: 2rem;
          }

          .ic-nav-prev {
            left: 0.5rem;
          }

          .ic-nav-next {
            right: 0.5rem;
          }

          .ic-nav-icon {
            width: 1rem;
            height: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
