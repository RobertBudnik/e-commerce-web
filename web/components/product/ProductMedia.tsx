import Image from 'next/image';
import { Icon } from '@/components/Icon';
import type { Product } from '@/lib/types';

/**
 * Zdjęcie produktu albo ikona zastępcza — katalog może mieć zdjęcia tylko
 * przy części pozycji. `next/image` dokłada skalowanie i format webp/avif,
 * czego statyczna wersja nie miała.
 */
export function ProductMedia({
  product,
  sizes = '(max-width: 700px) 92vw, 300px',
  priority = false,
}: {
  product: Product;
  sizes?: string;
  priority?: boolean;
}) {
  if (!product.image) return <Icon name={product.icon} />;

  return (
    <Image
      className="media-img"
      src={product.image}
      alt={product.name}
      fill
      sizes={sizes}
      priority={priority}
    />
  );
}
