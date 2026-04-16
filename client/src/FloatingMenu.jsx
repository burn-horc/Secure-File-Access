import { useState, useRef } from "react";

export default function FloatingMenu({ setShowNav }) {
  const [pos, setPos] = useState({ x: 20, y: 100 });
  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handleTouchStart = (e) => {
    dragging.current = true;
    moved.current = false;

    offset.current = {
      x: e.touches[0].clientX - pos.x,
      y: e.touches[0].clientY - pos.y,
    };
  };

  const handleTouchMove = (e) => {
    if (!dragging.current) return;

    e.preventDefault();
    moved.current = true;

    const x = e.touches[0].clientX - offset.current.x;
    const y = e.touches[0].clientY - offset.current.y;

    setPos({ x, y });
  };

  const handleTouchEnd = () => {
    dragging.current = false;
  };

  const handleClick = () => {
    if (moved.current) return;
    setShowNav(true);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 3000,
        touchAction: "none",
      }}
    >
      <button
        onClick={handleClick}
        style={{
          height: "52px",
          width: "52px",
          border: "none",
          color: "white",
          fontSize: "20px",
          fontWeight: "bold",
          background: "linear-gradient(135deg, #6f63ff, #8b5cf6)",
          boxShadow:
            "0 10px 25px rgba(0,0,0,0.5), 0 0 12px rgba(111,99,255,0.4)",
          clipPath: `polygon(
            30% 0%, 70% 0%,
            100% 30%, 100% 70%,
            70% 100%, 30% 100%,
            0% 70%, 0% 30%
          )`,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        ≡
      </button>
    </div>
  );
}
