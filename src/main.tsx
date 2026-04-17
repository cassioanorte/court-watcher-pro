import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const isAuthRoute = ["/auth", "/portal/login", "/admin/login"].includes(window.location.pathname);

if ("serviceWorker" in navigator) {
  const unregisterServiceWorkers = async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  };

  if (isPreviewHost || isInIframe || isAuthRoute) {
    void unregisterServiceWorkers();
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.update();
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!sessionStorage.getItem("sw-reloaded")) {
        sessionStorage.setItem("sw-reloaded", "1");
        window.location.reload();
      }
    });

    setTimeout(() => sessionStorage.removeItem("sw-reloaded"), 5000);
  }
}

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
