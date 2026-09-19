import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import type { Product } from '@/lib/types';
import { formatPriceSimple, discountPercent, classNames } from '@/lib/utils';
import StarRating from './StarRating';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export default function ProductCard({ product, className }: ProductCardProps) {
  const image = product.images?.[0]?.url ?? '';
  const discount = discountPercent(product.price, product.compare_price);

  return (
    <Link
      to={`/product/${product.id}`}
      className={classNames(
        'group bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-gray-300 flex flex-col',
        className
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {image ? (
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ShoppingBag size={48} />
          </div>
        )}
        {discount > 0 && (
          <span className="absolute top-2 start-2 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-md">
            -{discount}%
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-gray-400 mb-1">{product.brand || product.shop?.name}</p>
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1 group-hover:text-sky-600 transition-colors">
          {product.name}
        </h3>
        <StarRating rating={product.rating} size={14} showNumber count={product.rating_count} className="mb-2" />

        <div className="mt-auto flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-900">{formatPriceSimple(product.price)}</span>
          {product.compare_price && discount > 0 && (
            <span className="text-sm text-gray-400 line-through">{formatPriceSimple(product.compare_price)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
