import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { assetUrl } from '../api/client';

/** Carrusel interactivo: flechas, miniaturas, teclado, deslizamiento táctil y vista ampliada. */
export default function Carousel({ images, title }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const touch = useRef(null);
  const thumbs = useRef(null);
  const count = images.length;

  const go = useCallback((i) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);

  useEffect(() => {
    const el = thumbs.current?.children[index];
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);

  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setZoom(false);
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [zoom, index, go]);

  if (!count) return <div className="carousel carousel--empty">Sin fotografías</div>;

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  };
  const onTouchStart = (e) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    touch.current = null;
  };

  return (
    <div className="carousel" tabIndex={0} onKeyDown={onKeyDown} aria-roledescription="carrusel" aria-label={`Fotografías de ${title}`}>
      <div className="carousel__stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="carousel__track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {images.map((img, i) => (
            <div className="carousel__slide" key={img.id} aria-hidden={i !== index}>
              <img src={assetUrl(img.url)} alt={`${title} - foto ${i + 1}`} loading={i < 2 ? 'eager' : 'lazy'} onClick={() => setZoom(true)} />
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <button className="carousel__nav carousel__nav--prev" onClick={() => go(index - 1)} aria-label="Foto anterior"><ChevronLeft /></button>
            <button className="carousel__nav carousel__nav--next" onClick={() => go(index + 1)} aria-label="Foto siguiente"><ChevronRight /></button>
          </>
        )}
        <span className="carousel__counter">{index + 1} / {count}</span>
        <button className="carousel__zoom" onClick={() => setZoom(true)} aria-label="Ver en pantalla completa"><Expand size={18} /></button>
        <div className="carousel__dots">
          {images.map((img, i) => <button key={img.id} className={i === index ? 'is-active' : ''} onClick={() => go(i)} aria-label={`Ir a la foto ${i + 1}`} />)}
        </div>
      </div>

      <div className="carousel__thumbs" ref={thumbs}>
        {images.map((img, i) => (
          <button key={img.id} className={i === index ? 'is-active' : ''} onClick={() => go(i)} aria-label={`Miniatura ${i + 1}`}>
            <img src={assetUrl(img.url)} alt="" loading="lazy" />
          </button>
        ))}
      </div>

      {zoom && (
        <div className="lightbox" onClick={() => setZoom(false)} role="dialog" aria-modal="true">
          <button className="lightbox__close" aria-label="Cerrar"><X /></button>
          <button className="lightbox__nav lightbox__nav--prev" onClick={(e) => { e.stopPropagation(); go(index - 1); }} aria-label="Anterior"><ChevronLeft size={32} /></button>
          <img src={assetUrl(images[index].url)} alt={title} onClick={(e) => e.stopPropagation()} />
          <button className="lightbox__nav lightbox__nav--next" onClick={(e) => { e.stopPropagation(); go(index + 1); }} aria-label="Siguiente"><ChevronRight size={32} /></button>
          <span className="lightbox__counter">{index + 1} / {count}</span>
        </div>
      )}
    </div>
  );
}
