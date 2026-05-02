import { redirect } from 'next/navigation';

export default function RestaurantsIndexPage() {
  // Redirect users back to the home page if they land on /restaurants directly
  redirect('/');
}
