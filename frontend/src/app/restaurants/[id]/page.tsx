import RestaurantMenuClient from './ClientPage';

export const dynamicParams = true;

export default function RestaurantMenuPage({ params }: { params: { id: string } }) {
  return <RestaurantMenuClient restaurantId={params.id} />;
}
