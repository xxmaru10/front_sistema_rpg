"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Minus, RotateCcw, Check, X } from "lucide-react";
import { createPortal } from "react-dom";
import { ArenaPortraitFocus } from "@/types/domain";

interface ArenaFocusCropperProps {
    src: string;
    aspectRatio: number;
    initialFocus?: ArenaPortraitFocus;
    onConfirm: (focus: ArenaPortraitFocus) => void;
    onCancel: () => void;
}

const MAX_FRAME_DIM = 380;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

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

export function ArenaFocusCropper({
    src,
    aspectRatio,
    initialFocus,
    onConfirm,
    onCancel,
}: ArenaFocusCropperProps) {
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

            const normalizedFocusX = clamp(initialFocus?.x ?? 50, 0, 100);
            const normalizedFocusY = clamp(initialFocus?.y ?? 30, 0, 100);
            const zoomScale = clamp(initialFocus?.zoom ?? 1, 1, 3);
            const zoom = clamp(coverZoom * zoomScale, coverZoom, 10);

            const focusX = (normalizedFocusX / 100) * img.width;
            const focusY = (normalizedFocusY / 100) * img.height;
            const x = frameW / 2 - focusX * zoom;
            const y = frameH / 2 - focusY * zoom;
            const clamped = clampedOffset(x, y, zoom, img.width, img.height, frameW, frameH);
            setTransform({ zoom, ...clamped });
        },
        [frameW, frameH, initialFocus?.x, initialFocus?.y, initialFocus?.zoom]
    );

    useEffect(() => {
        const img = new Image();
        if (!src.startsWith("data:") && !src.startsWith("blob:")) {
            img.crossOrigin = "anonymous";
        }
        img.onload = () => {
            imgRef.current = img;
            setImgLoaded(true);
            initTransform(img);
        };
        img.onerror = () => {
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

    useEffect(() => {
        const el = frameRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            setTransform(prev => {
                const img = imgRef.current;
                if (!img) return prev;
                const factor = e.deltaY > 0 ? 0.92 : 1.08;
                const zoom = clamp(prev.zoom * factor, minZoomRef.current, 10);
                const clamped = clampedOffset(prev.x, prev.y, zoom, img.width, img.height, frameW, frameH);
                return { zoom, ...clamped };
            });
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [frameW, frameH]);

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

    const adjustZoom = (factor: number) => {
        setTransform(prev => {
            const img = imgRef.current;
            if (!img) return prev;
            const zoom = clamp(prev.zoom * factor, minZoomRef.current, 10);
            const clamped = clampedOffset(prev.x, prev.y, zoom, img.width, img.height, frameW, frameH);
            return { zoom, ...clamped };
        });
    };

    const handleReset = () => {
        if (imgRef.current) initTransform(imgRef.current);
    };

    const handleConfirm = () => {
        const img = imgRef.current;
        if (!img) return;

        const centerX = (frameW / 2 - transform.x) / transform.zoom;
        const centerY = (frameH / 2 - transform.y) / transform.zoom;
        const x = clamp((centerX / img.width) * 100, 0, 100);
        const y = clamp((centerY / img.height) * 100, 0, 100);
        const zoom = clamp(transform.zoom / minZoomRef.current, 1, 3);

        onConfirm({
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
            zoom: Math.round(zoom * 100) / 100,
        });
    };

    const content = (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.95)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2147483647,
            }}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "#0a0a0a",
                    border: "2px solid #C5A059",
                    borderRadius: "4px",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "14px",
                    boxShadow: "0 0 50px rgba(197, 160, 89, 0.35), 0 20px 60px rgba(0,0,0,0.9)",
                    maxWidth: "95vw",
                    maxHeight: "95vh",
                }}
            >
                <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: "bold", letterSpacing: "0.15em", color: "#C5A059", textTransform: "uppercase" }}>
                        AJUSTAR FOCO DA ARENA
                    </span>
                    <button
                        onClick={onCancel}
                        style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: "4px", lineHeight: 1 }}
                        aria-label="Fechar"
                    >
                        <X size={15} />
                    </button>
                </div>

                <p style={{ fontSize: "0.58rem", color: "#666", letterSpacing: "0.07em", margin: "-6px 0 0", textAlign: "center" }}>
                    Este foco será usado no retrato da arena. Arraste para posicionar e ajuste o zoom.
                </p>

                <div
                    ref={frameRef}
                    style={{
                        position: "relative",
                        overflow: "hidden",
                        border: "1px solid rgba(197, 160, 89, 0.35)",
                        flexShrink: 0,
                        width: frameW,
                        height: frameH,
                        cursor: isDragging ? "grabbing" : "grab",
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                >
                    <canvas ref={canvasRef} width={frameW} height={frameH} style={{ display: "block" }} />
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            border: "2px solid rgba(197, 160, 89, 0.6)",
                            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.55), inset 0 0 20px rgba(0,0,0,0.2)",
                            pointerEvents: "none",
                        }}
                    />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        onClick={() => adjustZoom(0.85)}
                        style={{ background: "#141414", border: "1px solid #2a2a2a", color: "#C5A059", cursor: "pointer", width: "30px", height: "30px", borderRadius: "3px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        title="Reduzir zoom"
                    >
                        <Minus size={14} />
                    </button>
                    <button
                        onClick={handleReset}
                        style={{ background: "#141414", border: "1px solid #2a2a2a", color: "#C5A059", cursor: "pointer", width: "30px", height: "30px", borderRadius: "3px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        title="Resetar"
                    >
                        <RotateCcw size={13} />
                    </button>
                    <button
                        onClick={() => adjustZoom(1.18)}
                        style={{ background: "#141414", border: "1px solid #2a2a2a", color: "#C5A059", cursor: "pointer", width: "30px", height: "30px", borderRadius: "3px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        title="Aumentar zoom"
                    >
                        <Plus size={14} />
                    </button>
                    <span style={{ fontSize: "0.6rem", color: "#666", minWidth: "38px", textAlign: "center", letterSpacing: "0.04em" }}>
                        {Math.round(transform.zoom * 100)}%
                    </span>
                </div>

                <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "flex-end", paddingTop: "2px" }}>
                    <button
                        onClick={onCancel}
                        style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#666", padding: "8px 16px", fontSize: "0.62rem", letterSpacing: "0.1em", cursor: "pointer", borderRadius: "2px", textTransform: "uppercase" }}
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{ background: "linear-gradient(135deg, #C5A059 0%, #8B7240 100%)", border: "none", color: "#0a0a0a", padding: "8px 18px", fontSize: "0.62rem", fontWeight: "bold", letterSpacing: "0.1em", cursor: "pointer", borderRadius: "2px", display: "inline-flex", alignItems: "center", gap: "6px", textTransform: "uppercase" }}
                    >
                        <Check size={13} />
                        CONFIRMAR
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document !== "undefined") {
        return createPortal(content, document.body);
    }
    return content;
}

