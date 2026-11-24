/** Tech & repairs v2 · service details: /services/<repairs|tailoring|laundry>/<catalogue item id> (modules/servicesV2). */
import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import ServicesV2Detail from '../../../modules/servicesV2/ServicesV2Detail';
import { isServiceShelf } from '../../../modules/servicesV2/servicesV2Data';
import { useLaunchSections } from '../../../utils/launchSections';

export default function ServiceDetailRoute() {
  const p = useLocalSearchParams<{ shelf?: string | string[]; id?: string | string[] }>();
  const shelf = String(Array.isArray(p.shelf) ? p.shelf[0] : p.shelf || '').toLowerCase();
  const id = String(Array.isArray(p.id) ? p.id[0] : p.id || '');
  // Laundry-only launch (owner, 24 Nov 2026; utils/launchSections): only laundry details open until the admins switch
  // the other services back on.
  const launch = useLaunchSections();
  if (isServiceShelf(shelf) && shelf !== 'laundry' && launch.laundryOnly) {
    return launch.settled ? <Redirect href={'/(tabs)/services?tab=services' as any} /> : null;
  }
  if (!isServiceShelf(shelf)) return <Redirect href={'/(tabs)/services?tab=services' as any} />;
  return <ServicesV2Detail key={`${shelf}-${id}`} shelf={shelf} id={id} />;
}
