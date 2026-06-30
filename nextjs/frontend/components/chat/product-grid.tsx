import Image from 'next/image';
import type { Product } from '@/types/api';

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) return null;

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {products.map((product, index) => (
        <div
          key={`${product.title}-${index}`}
          className="rounded-xl border border-white/10 bg-white/5 p-3"
        >
          {product.image_urls[0] && (
            <div className="relative overflow-hidden rounded-lg mb-2">
              <Image
                src={encodeURI(product.image_urls[0])}
                alt={product.title}
                width={280}
                height={140}
                className="w-full h-28 object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}
          <h4 className="font-semibold text-sm text-white line-clamp-2 mb-1">
            {product.title}
          </h4>
          {product.description && (
            <p className="text-xs text-gray-400 line-clamp-2 mb-2">{product.description}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-emerald-400">
              {Number.isFinite(product.price) && product.price > 0
                ? `¥${product.price.toLocaleString()}`
                : '価格情報なし'}
            </p>
            {product.affiliate_url && (
              <a
                href={product.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white shrink-0"
              >
                見る
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
