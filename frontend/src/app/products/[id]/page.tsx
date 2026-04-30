import ProductDetailClient from './ClientPage';

export function generateStaticParams() {
  return [{ id: '1' }];
}

export const dynamicParams = false;

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  return <ProductDetailClient productId={params.id} />;
}
