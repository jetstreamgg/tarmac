import { AboutStUsds } from '@/modules/ui/components/AboutStUsds';
import { AboutUsds } from '@/modules/ui/components/AboutUsds';

// This will include all the cards for the expert modules
export function ExpertAbout() {
  return (
    <div>
      <AboutStUsds module="expert-modules-banners" />
      <AboutUsds />
    </div>
  );
}
