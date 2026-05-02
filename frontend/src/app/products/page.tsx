import { redirect } from 'next/navigation';

export default function ProductsIndexPage() {
  // Redirect users back to the home page if they land on /products directly
  redirect('/');
}
