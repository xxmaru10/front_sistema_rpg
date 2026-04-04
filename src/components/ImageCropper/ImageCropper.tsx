"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Plus, Minus, RotateCcw, Check, X } from "lucide-react";
import { createPortal } from "react-dom";
import { ImageCropperStyles } from "./ImageCropper.styles";

export interface ImageCropperProps {
    src: string;
    /** width / height ratio — e.g. 1 for square, 1200/720 for map */
    aspectRatio: number;
    outputWidth: number;
    outputHeight: number;
    onConfirm: (base64: string) => void;
    onCancel: () => void;
}

const MAX_FRAME_DIM = 380;

function clampedOffset(
    x: number,
    y: number,
    zoom: number,
    imgW: number,
    imgH: number,
    frameW: number,
    frameH: number
) {
    return {
        x: Math.min(0, Math.max(frameW - imgW * zoom, x)),
        y: Math.min(0, Math.max(frameH - imgH * zoom, y)),
    };
}

export function ImageCropper({
    src,
    aspectRatio,
    outputWidth,
    outputHeight,
    onConfirm,
    onCancel,
}: ImageCropperProps) {
    const frameW = aspectRatio >= 1 ? MAX_FRAME_DIM : Math.round(MAX_FRAME_DIM * aspectRatio);
    const frameH = aspectRatio >= 1 ? Math.round(MAX_FRAME_DIM / aspectRatio) : MAX_FRAME_DIM;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const minZoomRef = useRef(1);
    const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

    const [transform, setTransform] = useState({ zoom: 1, x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);

    const initTransform = useCallback(
        (img: HTMLImageElement) => {
            const coverZoom = Math.max(frameW / img.width, frameH / img.height);
            minZoomRef.current = coverZoom;
            const x = (frameW - img.width * coverZoom) / 2;
            const y = (frameH - img.height * coverZoom) / 2;
            setTransform({ zoom: coverZoom, x, y });
        },
        [frameW, frameH]
    );

    // Load source image — crossOrigin needed for Supabase URLs to allow canvas toDataURL
    useEffect(() => {
        const img = new Image();
        if (!src.startsWith("data:")) {
            img.crossOrigin = "anonymous";
        }
        img.onload = () => {
            imgRef.current = img;
            setImgLoaded(true);
            initTransform(img);
        };
        img.onerror = () => {
            // If CORS fails, retry without crossOrigin (image will be tainted but visible)
            const fallback = new Image();
            fallback.onload = () => {
                imgRef.current = fallback;
                setImgLoaded(true);
                initTransform(fallback);
            };
            fallback.src = src;
        };
        img.src = src;
    }, [src, initTransform]);

    // Draw canvas whenever transform changes
    useEffect(() => {
        if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, frameW, frameH);
        ctx.drawImage(
            imgRef.current,
            transform.x,
            transform.y,
            imgRef.current.width * transform.zoom,
            imgRef.current.height * transform.zoom
        );
    }, [transform, imgLoaded, frameW, frameH]);

    // Non-passive wheel listener (React synthetic onWheel is passive in Next.js 15)
    useEffect(() => {
        const el = frameRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.92 : 1.08;
            setTransform(prev => {
                const img = imgRef.current;
                if (!img) return prev;
                const newZoom = Math.max(minZoomRef.current, Math.min(10, prev.zoom * factor));
                const clamped = clampedOffset(prev.x, prev.y, newZoom, img.width, img.height, frameW, frameH);
                return { zoom: newZoom, ...clamped };
            });
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [frameW, frameH]);

    // ── Mouse handlers ────────────────────────────────────────────────────────
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, ox: transform.x, oy: transform.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !imgRef.current) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        const clamped = clampedOffset(
            dragStart.current.ox + dx,
            dragStart.current.oy + dy,
            transform.zoom,
            imgRef.current.width,
            imgRef.current.height,
            frameW,
            frameH
        );
        setTransform(prev => ({ ...prev, ...clamped }));
    };

    const handleMouseUp = () => setIsDragging(false);

    // ── Touch handlers ────────────────────────────────────────────────────────
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        setIsDragging(true);
        dragStart.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            ox: transform.x,
            oy: transform.y,
        };
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length !== 1 || !isDragging || !imgRef.current) return;
        const dx = e.touches[0].clientX - dragStart.current.x;
        const dy = e.touches[0].clientY - dragStart.current.y;
        const clamped = clampedOffset(
            dragStart.current.ox + dx,
            dragStart.current.oy + dy,
            transform.zoom,
            imgRef.current.width,
            imgRef.current.height,
            frameW,
            frameH
        );
        setTransform(prev => ({ ...prev, ...clamped }));
    };

    const handleTouchEnd = () => setIsDragging(false);

    // ── Zoom controls ─────────────────────────────────────────────────────────
    const adjustZoom = (factor: number) => {
        setTransform(prev => {
            const img = imgRef.current;
            if (!img) return prev;
            const newZoom = Math.max(minZoomRef.current, Math.min(10, prev.zoom * factor));
            const clamped = clampedOffset(prev.x, prev.y, newZoom, img.width, img.height, frameW, frameH);
            return { zoom: newZoom, ...clamped };
        });
    };

    const handleReset = () => {
        if (imgRef.current) initTransform(imgRef.current);
    };

    // ── Confirm: extract visible region → output canvas ───────────────────────
    const handleConfirm = () => {
        const img = imgRef.current;
        if (!img) return;
        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = outputWidth;
        outputCanvas.height = outputHeight;
        const ctx = outputCanvas.getContext("2d");
        if (!ctx) return;

        const srcX = -transform.x / transform.zoom;
        const srcY = -transform.y / transform.zoom;
        const srcW = frameW / transform.zoom;
        const srcH = frameH / transform.zoom;

        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputWidth, outputHeight);
        onConfirm(outputCanvas.toDataURL("image/jpeg", 0.7));
    };

    const content = (
        <>
            <ImageCropperStyles />
            <div className="ic-overlay" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                <div className="ic-container" onClick={e => e.stopPropagation()}>
                    <div className="ic-header">
                        <span className="ic-title">AJUSTAR ENQUADRAMENTO</span>
                        <button className="ic-close" onClick={onCancel} aria-label="Fechar">
                            <X size={15} />
                        </button>
                    </div>

                    <p className="ic-hint">Arraste para posicionar · Scroll ou botões para zoom</p>

                    <div
                        ref={frameRef}
                        className="ic-frame"
                        style={{
                            width: frameW,
                            height: frameH,
                            cursor: isDragging ? "grabbing" : "grab",
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <canvas ref={canvasRef} width={frameW} height={frameH} className="ic-canvas" />
                        <div className="ic-border-overlay" />
                    </div>

                    <div className="ic-controls">
                        <button className="ic-btn" onClick={() => adjustZoom(0.85)} title="Reduzir zoom">
                            <Minus size={14} />
                        </button>
                        <button className="ic-btn" onClick={handleReset} title="Resetar">
                            <RotateCcw size={13} />
                        </button>
                        <button className="ic-btn" onClick={() => adjustZoom(1.18)} title="Aumentar zoom">
                            <Plus size={14} />
                        </button>
                        <span className="ic-zoom-label">{Math.round(transform.zoom * 100)}%</span>
                    </div>

                    <div className="ic-footer">
                        <button className="ic-cancel-btn" onClick={onCancel}>CANCELAR</button>
                        <button className="ic-confirm-btn" onClick={handleConfirm}>
                            <Check size={13} />
                            CONFIRMAR
                        </button>
                    </div>
                </div>
            </div>
        </>
    );

    if (typeof document !== "undefined") {
        return createPortal(content, document.body);
    }
    return content;
}
