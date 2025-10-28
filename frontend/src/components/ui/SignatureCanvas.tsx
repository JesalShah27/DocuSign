/**
 * SignatureCanvas component for the DocUsign application
 * 
 * A drawing canvas for capturing digital signatures with touch and mouse support.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface SignatureCanvasProps {
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  onChange?: (dataUrl: string) => void;
  className?: string;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  width = 500,
  height = 200,
  penColor = '#111827',
  backgroundColor = '#ffffff',
  onChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctxRef.current = ctx;
    
    // Initialize canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [backgroundColor, penColor]);

  const getPointerPosition = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    const ctx = ctxRef.current!;
    const { x, y } = getPointerPosition(e);
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getPointerPosition]);

  const draw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    
    const ctx = ctxRef.current!;
    const { x, y } = getPointerPosition(e);
    
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [drawing, getPointerPosition]);

  const endDrawing = useCallback(() => {
    if (!drawing) return;
    
    setDrawing(false);
    ctxRef.current?.closePath();
    
    // Notify parent of signature change
    if (onChange && canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  }, [drawing, onChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = ctxRef.current!;
    
    // Clear and reset background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Notify parent that signature was cleared
    if (onChange) {
      onChange('');
    }
  }, [backgroundColor, onChange]);

  return (
    <div className={`signature-canvas ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border rounded-md touch-none bg-white cursor-crosshair"
        style={{ 
          width: '100%', 
          height: `${height}px`,
          maxWidth: `${width}px`
        }}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={endDrawing}
        onPointerLeave={endDrawing}
      />
      <div className="mt-2 text-right">
        <button
          onClick={clearCanvas}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          type="button"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default SignatureCanvas;