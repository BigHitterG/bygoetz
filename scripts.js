const surface = document.querySelector("[data-grid-surface]");
const field = document.querySelector("[data-bubble-field]");

if (surface && field) {
  const spacing = 86;
  const rows = 13;
  const columns = 13;
  const position = { x: 0, y: 0 };
  let drag = null;
  let animationFrame = null;

  function buildBubbles() {
    const bubbles = [];
    const rowOffset = (rows - 1) / 2;
    const columnOffset = (columns - 1) / 2;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const bubble = document.createElement("span");
        const x = (column - columnOffset + (row % 2 ? 0.5 : 0)) * spacing;
        const y = (row - rowOffset) * spacing * 0.86;
        const distance = Math.hypot(column - columnOffset, row - rowOffset);
        const hue = (row * 31 + column * 19) % 360;
        const scale = Math.max(0.72, 1.08 - distance * 0.035);

        bubble.className = "bubble";
        bubble.style.setProperty("--x", `${x}px`);
        bubble.style.setProperty("--y", `${y}px`);
        bubble.style.setProperty("--hue", hue);
        bubble.style.setProperty("--scale", scale.toFixed(2));
        bubbles.push(bubble);
      }
    }

    field.replaceChildren(...bubbles);
  }

  function applyPosition() {
    animationFrame = null;
    field.style.setProperty("--grid-x", `${position.x}px`);
    field.style.setProperty("--grid-y", `${position.y}px`);
  }

  function requestPositionUpdate() {
    if (animationFrame) return;
    animationFrame = window.requestAnimationFrame(applyPosition);
  }

  function endDrag() {
    drag = null;
    surface.classList.remove("is-dragging");
  }

  surface.addEventListener("pointerdown", (event) => {
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    surface.classList.add("is-dragging");
    surface.setPointerCapture(event.pointerId);
  });

  surface.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;

    position.x += event.clientX - drag.x;
    position.y += event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    requestPositionUpdate();
  });

  surface.addEventListener("pointerup", endDrag);
  surface.addEventListener("pointercancel", endDrag);

  buildBubbles();
  applyPosition();
}
