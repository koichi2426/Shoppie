import Image from 'next/image';
import type { Product } from '@/types/api';

type DisplayProduct = Product & { marketplace?: string | null };

const MARKETPLACE_STYLES: Record<string, string> = {
  Yahoo: 'bg-red-500/20 text-red-200 border-red-400/30',
  楽天: 'bg-pink-500/20 text-pink-200 border-pink-400/30',
  Amazon: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
};

export function ChatProductCard({ product }: { product: DisplayProduct }) {
  const marketplace = product.marketplace ?? null;
  const badgeClass =
    marketplace && MARKETPLACE_STYLES[marketplace]
      ? MARKETPLACE_STYLES[marketplace]
      : 'bg-white/10 text-white/70 border-white/15';

  return (
    <a
      href={product.affiliate_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-400/30 transition-all overflow-hidden"
    >
      <div className="relative aspect-[4/3] w-full bg-white/5">
        <Image
          src={product.image_urls[0] ? encodeURI(product.image_urls[0]) : '/placeholder.jpg'}
          alt={product.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 50vw"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.jpg';
          }}
        />
        {marketplace && (
          <span
            className={`absolute top-2 left-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${badgeClass}`}
          >
            {marketplace}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-white line-clamp-2 leading-snug mb-2 min-h-[2.5rem]">
          {product.title}
        </p>
        <p className="text-base font-bold text-cyan-300">
          {product.price > 0
            ? `¥${product.price.toLocaleString()}`
            : 'Amazonで確認'}
        </p>
      </div>
    </a>
  );
}

export function ProductGrid({ products }: { products: DisplayProduct[] }) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      {products.map((product, index) => (
        <ChatProductCard key={`${product.affiliate_url}-${index}`} product={product} />
      ))}
    </div>
  );
}
