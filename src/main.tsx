import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// ── Force-clear stale Service Workers so new code is never blocked by old cache ──
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.update(); // ask SW to check for new version immediately
    }
  });
  // Listen for new SW and auto-activate it (skip waiting)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // A new SW took over — reload once to pick up fresh assets
    if (!sessionStorage.getItem("sw-reloaded")) {
      sessionStorage.setItem("sw-reloaded", "1");
      window.location.reload();
    }
  });
  // Clear the reload flag after 5s so future updates also trigger reload
  setTimeout(() => sessionStorage.removeItem("sw-reloaded"), 5000);
}
import "./index.css";

// Prevent "removeChild" / "insertBefore" DOM errors caused by
// browser extensions (e.g. Google Translate, Grammarly) that
// modify the DOM outside React's control.
const originalRemoveChild = Node.prototype.removeChild;
// @ts-ignore
Node.prototype.removeChild = function <T extends Node>(child: T): T {
  if (child.parentNode !== this) {
    console.warn("removeChild: node is not a child of this node", child);
    return child;
  }
  return originalRemoveChild.call(this, child) as T;
};

const originalInsertBefore = Node.prototype.insertBefore;
// @ts-ignore
Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
  if (refNode && refNode.parentNode !== this) {
    console.warn("insertBefore: refNode is not a child of this node", refNode);
    return newNode;
  }
  return originalInsertBefore.call(this, newNode, refNode) as T;
};

createRoot(document.getElementById("root")!).render(<App />);
