import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const PWA_DISMISSED_KEY = "contanossa:pwa-install-dismissed";

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
  return isIos && isSafari;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [sidebarInstallCtaVisible, setSidebarInstallCtaVisible] = useState(false);

  const canShowPrompt = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (!isMobileDevice()) return false;
    if (isStandaloneMode()) return false;
    return localStorage.getItem(PWA_DISMISSED_KEY) !== "true";
  }, []);

  useEffect(() => {
    const handleSidebarCta = (event: Event) => {
      const customEvent = event as CustomEvent<{ visible?: boolean }>;
      setSidebarInstallCtaVisible(Boolean(customEvent.detail?.visible));
      if (customEvent.detail?.visible) {
        setVisible(false);
      }
    };

    window.addEventListener("contanossa:pwa-sidebar-cta", handleSidebarCta as EventListener);

    return () => {
      window.removeEventListener("contanossa:pwa-sidebar-cta", handleSidebarCta as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!canShowPrompt) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (!sidebarInstallCtaVisible) {
        setVisible(true);
      }
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (isIosSafari() && !sidebarInstallCtaVisible) {
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [canShowPrompt, sidebarInstallCtaVisible]);

  if (!canShowPrompt || !visible || sidebarInstallCtaVisible) return null;

  const dismissPrompt = () => {
    localStorage.setItem(PWA_DISMISSED_KEY, "true");
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      dismissPrompt();
      return;
    }

    try {
      setInstalling(true);
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
      dismissPrompt();
    }
  };

  return (
    <div className="fixed inset-x-3 top-3 z-[70] md:hidden">
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-md p-4 shadow-lg">
        <p className="text-sm font-semibold text-foreground">Instalar ContaNossa</p>
        {deferredPrompt ? (
          <p className="text-xs text-muted-foreground mt-1">Adicione o app no seu celular para abrir mais rápido.</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            No iPhone: toque em Compartilhar e depois em Adicionar à Tela de Início.
          </p>
        )}
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={dismissPrompt}>
            Agora não
          </Button>
          {deferredPrompt && (
            <Button size="sm" className="h-8 text-xs" onClick={() => void handleInstall()} disabled={installing}>
              {installing ? "Instalando..." : "Instalar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
