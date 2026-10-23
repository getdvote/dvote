import { Channel } from '@/components/sections/channel';
import { ChannelCompare } from '@/components/sections/channel-compare';
import { FaqContact } from '@/components/sections/faq-contact';
import { Geo } from '@/components/sections/geo';
import { Hero } from '@/components/sections/hero';
import { Platform } from '@/components/sections/platform';
import { Pricing } from '@/components/sections/pricing';
import { Problem } from '@/components/sections/problem';
import { Stand } from '@/components/sections/stand';
import { Steps } from '@/components/sections/steps';

/** dvote.co is one page; the header links jump to its sections. */
export function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <Steps />
      <Stand />
      <Platform />
      <Channel />
      <ChannelCompare />
      <Geo />
      <Pricing />
      <FaqContact />
    </>
  );
}
