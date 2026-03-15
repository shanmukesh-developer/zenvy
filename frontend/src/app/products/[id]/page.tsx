import { restaurants } from '@/data/restaurants';
import ProductDetailClient from './ClientPage';

export function generateStaticParams() {
  const products = restaurants.flatMap((r) => r.menu);
  return products.map((product) => ({
    id: product.id,
  }));
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  return <ProductDetailClient productId={params.id} />;
}
