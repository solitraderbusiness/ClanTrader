"use client";

import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

const CANDLE_DATA = [
  { x: -5, open: 0, close: 1.5, high: 2.2, low: -0.5 },
  { x: -4, open: 1.5, close: 0.8, high: 2.0, low: 0.2 },
  { x: -3, open: 0.8, close: 2.0, high: 2.8, low: 0.3 },
  { x: -2, open: 2.0, close: 1.2, high: 2.5, low: 0.8 },
  { x: -1, open: 1.2, close: 2.5, high: 3.0, low: 0.9 },
  { x: 0, open: 2.5, close: 1.8, high: 3.2, low: 1.2 },
  { x: 1, open: 1.8, close: 3.0, high: 3.5, low: 1.5 },
  { x: 2, open: 3.0, close: 2.2, high: 3.4, low: 1.8 },
  { x: 3, open: 2.2, close: 3.5, high: 4.0, low: 1.9 },
  { x: 4, open: 3.5, close: 2.8, high: 4.2, low: 2.3 },
  { x: 5, open: 2.8, close: 4.0, high: 4.5, low: 2.5 },
];

function Candlestick({
  x,
  open,
  close,
  high,
  low,
}: {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
}) {
  const bullish = close > open;
  const color = bullish ? "#4ade80" : "#ef4444";
  const bodyHeight = Math.abs(close - open) || 0.1;
  const bodyCenter = (open + close) / 2;
  const wickHeight = high - low;
  const wickCenter = (high + low) / 2;

  return (
    <group position={[x * 0.9, 0, 0]}>
      {/* Candle body */}
      <mesh position={[0, bodyCenter, 0]}>
        <boxGeometry args={[0.5, bodyHeight, 0.5]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Wick */}
      <mesh position={[0, wickCenter, 0]}>
        <boxGeometry args={[0.06, wickHeight, 0.06]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;
    const targetX = pointer.x * 0.5;
    const targetY = pointer.y * 0.3;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetX,
      0.05
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      -targetY * 0.3,
      0.05
    );
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
        <group position={[0, -1, 0]}>
          {CANDLE_DATA.map((c, i) => (
            <Candlestick key={i} {...c} />
          ))}
        </group>
      </Float>

      <ambientLight intensity={0.4} />
      <pointLight position={[-4, 5, 3]} color="#4ade80" intensity={30} />
      <pointLight position={[4, -3, 3]} color="#ef4444" intensity={20} />
    </group>
  );
}

export default function CandlestickScene() {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      camera={{ position: [0, 2, 12], fov: 45 }}
      style={{ width: "100%", height: "100%" }}
    >
      <Scene />
    </Canvas>
  );
}
