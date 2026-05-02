import RestaurantMenuClient from './ClientPage';

export function generateStaticParams() {
  return [{ id: '1' }];
}

export const dynamicParams = true;

export default function RestaurantMenuPage({ params }: { params: { id: string } }) {
  return <RestaurantMenuClient restaurantId={params.id} />;
}
