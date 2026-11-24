"use client";

// Home slideshow (owner, 24-25 Nov 2026): which dishes the customer app's Home slideshow shows per diet, and the image
// each dish shows there (the admin's own image, the automatic cut-out, or the round photo).
// Backend: GET / PUT /api/admin/home-slideshow, GET /api/admin/home-slideshow/dishes, PUT /api/admin/menu-items/:id/slideshow
// (controllers/homeSlideshowController; cut-outs by utils/cutoutQueue).
import { useAdminAuth } from '@/utils/useAdminAuth';
import { LoadingState, PageHeader } from '@/components/ui';
import HomeSlideshowEditor from '@/components/config/HomeSlideshowEditor';

export default function HomeSlideshowPage() {
  const { isAuthed } = useAdminAuth();
  if (!isAuthed) return <LoadingState />;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Home slideshow"
        description="Pick up to 4 dishes per diet for the slideshow at the top of Home, and choose the image each dish shows there. With no dishes picked the app shows the biggest discounts."
      />
      <HomeSlideshowEditor />
    </div>
  );
}
