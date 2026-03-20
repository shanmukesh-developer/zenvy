import ProductDetailClient from './ClientPage';

export const dynamicParams = true;

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  return <ProductDetailClient productId={params.id} />;
}
