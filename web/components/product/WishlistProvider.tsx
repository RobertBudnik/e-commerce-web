'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition } from 'react';
import { toggleWishlistAction, wishlistIdsAction } from '@/app/actions/shop';
import { toast } from '@/components/ui/ToastHost';

type WishContext = {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
};

const Ctx = createContext<WishContext | null>(null);

/**
 * Lista życzeń trzymana w tabeli `wishlists` — jedzie z kontem, nie
 * z przeglądarką. Zapis i odczyt idą przez Server Actions, więc karta nie
 * potrzebuje tokenu; zakresu pilnuje polityka „lista życzeń: własna".
 */
export function WishlistProvider({
  children,
  signedIn,
}: {
  children: React.ReactNode;
  signedIn: boolean;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!signedIn) {
      setIds([]);
      return;
    }
    let cancelled = false;
    wishlistIdsAction().then((list) => {
      if (!cancelled) setIds(list);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const toggle = useCallback(
    (id: string) => {
      if (!signedIn) {
        toast('Zaloguj się, żeby zapisać listę życzeń');
        return;
      }

      // Optymistycznie: serce reaguje od razu, a odmowa cofa stan
      const on = !ids.includes(id);
      setIds((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

      startTransition(async () => {
        const result = await toggleWishlistAction(id);
        if ('error' in result) {
          setIds((prev) => (on ? prev.filter((x) => x !== id) : [...prev, id]));
          toast(result.error);
          return;
        }
        toast(result.saved ? 'Dodano do listy życzeń' : 'Usunięto z listy życzeń');
      });
    },
    [ids, signedIn]
  );

  const value = useMemo<WishContext>(
    () => ({ ids, has: (id) => ids.includes(id), toggle }),
    [ids, toggle]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWishlist poza WishlistProvider');
  return ctx;
}
