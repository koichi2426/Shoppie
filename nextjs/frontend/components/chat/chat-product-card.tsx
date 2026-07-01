import Image from 'next/image';
import type { Product } from '@/types/api';

export function ChatProductCard({ product }: { product: Product }) {
  return (
    <a
      href={product.affiliate_url}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 w-44 sm:w-48 block rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-400/30 transition-all overflow-hidden"
    >
      <div className="relative h-28 w-full bg-white/5">
        <Image
          src={product.image_urls[0] ? encodeURI(product.image_urls[0]) : '/placeholder.jpg'}
          alt={product.title}
          fill
          className="object-cover"
          sizes="192px"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.jpg';
          }}
        />
      </div>
      <div className="p-2.5">
        <p className="text-xs font-medium text-white line-clamp-2 leading-snug mb-1">
          {product.title}
        </p>
        <p className="text-sm font-bold text-cyan-300">
          {product.price > 0
            ? `¥${product.price.toLocaleString()}`
            : 'Amazonで確認'}
        </p>
      </div>
    </a>
  );
}
