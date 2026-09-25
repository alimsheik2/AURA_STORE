import { Star } from 'lucide-react';
import { classNames } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  size?: number;
  showNumber?: boolean;
  count?: number;
  className?: string;
}

export default function StarRating({ rating, size = 16, showNumber = false, count, className }: StarRatingProps) {
  return (
    <div className={classNames('flex items-center gap-1', className)}>
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.floor(rating);
          const half = star === Math.ceil(rating) && rating % 1 >= 0.5;
          return (
            <Star
              key={star}
              size={size}
              className={classNames(
                filled || half ? 'text-amber-400' : 'text-gray-300'
              )}
              fill={filled ? 'currentColor' : half ? 'url(#half)' : 'none'}
            />
          );
        })}
      </div>
      {showNumber && (
        <span className="text-sm font-medium text-gray-700">
          {rating.toFixed(1)}
          {count !== undefined && <span className="text-gray-400 ml-1">({count})</span>}
        </span>
      )}
    </div>
  );
}
