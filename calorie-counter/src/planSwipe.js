// Bidirectional swipe-to-act for Plano item rows: swiping left reveals a
// "Excluir"/delete strip, swiping right reveals an "Editar" strip —
// dragging far enough past either triggers it immediately, dragging
// partway snaps it open for a follow-up tap. Same pointer-event-based
// mechanics as main.js's wireSwipeToDelete (log entries), generalized to
// two directions and kept separate so neither file risks regressing the
// other's already-working swipe behavior.
const OPEN_PX = 88;
const AUTO_PX = 160;
let openWrap = null;

function closeRow(wrap, row) {
  wrap.classList.remove("swipe-open-left", "swipe-open-right");
  row.style.transform = "";
  if (openWrap === wrap) openWrap = null;
}

// `onDelete`/`onEdit` are optional — omitting one disables swiping that
// direction entirely (the row just won't move that way).
export function wireSwipe(wrap, row, { onDelete, onEdit } = {}) {
  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let dragging = false;
  let decided = false;

  row.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("button, input")) return;
    startX = ev.clientX;
    startY = ev.clientY;
    baseX = wrap.classList.contains("swipe-open-left")
      ? -OPEN_PX
      : wrap.classList.contains("swipe-open-right")
      ? OPEN_PX
      : 0;
    decided = false;
    dragging = false;
  });

  row.addEventListener("pointermove", (ev) => {
    if (!startX && !startY) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decided = true;
      dragging = Math.abs(dx) > Math.abs(dy);
      if (dragging) {
        row.classList.add("swipe-dragging");
        row.setPointerCapture(ev.pointerId);
        if (openWrap && openWrap !== wrap) closeRow(openWrap, openWrap.querySelector(".plan-item"));
      }
    }
    if (!dragging) return;
    ev.preventDefault();
    const minX = onDelete ? -AUTO_PX : 0;
    const maxX = onEdit ? AUTO_PX : 0;
    const x = Math.min(maxX, Math.max(baseX + dx, minX));
    row.style.transform = `translateX(${x}px)`;
  });

  async function finishDrag() {
    if (!dragging) {
      startX = 0;
      startY = 0;
      return;
    }
    row.classList.remove("swipe-dragging");
    row.dataset.suppressClick = "1";
    setTimeout(() => delete row.dataset.suppressClick, 0);
    const matrix = new DOMMatrixReadOnly(getComputedStyle(row).transform);
    const currentX = matrix.m41;
    if (onDelete && currentX <= -AUTO_PX + 8) {
      await onDelete();
      closeRow(wrap, row);
    } else if (onDelete && currentX <= -OPEN_PX / 2) {
      wrap.classList.add("swipe-open-left");
      row.style.transform = `translateX(${-OPEN_PX}px)`;
      openWrap = wrap;
    } else if (onEdit && currentX >= AUTO_PX - 8) {
      onEdit();
      closeRow(wrap, row);
    } else if (onEdit && currentX >= OPEN_PX / 2) {
      wrap.classList.add("swipe-open-right");
      row.style.transform = `translateX(${OPEN_PX}px)`;
      openWrap = wrap;
    } else {
      closeRow(wrap, row);
    }
    startX = 0;
    startY = 0;
    dragging = false;
    decided = false;
  }

  row.addEventListener("pointerup", finishDrag);
  row.addEventListener("pointercancel", () => {
    row.classList.remove("swipe-dragging");
    if (!wrap.classList.contains("swipe-open-left") && !wrap.classList.contains("swipe-open-right")) {
      row.style.transform = "";
    }
    startX = 0;
    startY = 0;
    dragging = false;
    decided = false;
  });

  row.addEventListener("click", () => {
    if (wrap.classList.contains("swipe-open-left") || wrap.classList.contains("swipe-open-right")) {
      closeRow(wrap, row);
    }
  });
}
