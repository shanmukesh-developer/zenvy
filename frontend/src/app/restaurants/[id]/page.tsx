import { restaurants } from '@/data/restaurants';
import RestaurantMenuClient from './ClientPage';

export function generateStaticParams() {
  return restaurants.map((restaurant) => ({
    id: restaurant.id,
  }));
}

export default function RestaurantMenuPage({ params }: { params: { id: string } }) {
  return <RestaurantMenuClient restaurantId={params.id} />;
}
