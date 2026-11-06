import { Comeback } from '@/components/sections/comeback';
import { FaqContact } from '@/components/sections/faq-contact';
import { Hero } from '@/components/sections/hero';
import { Platform } from '@/components/sections/platform';
import { Pricing } from '@/components/sections/pricing';
import { Problem } from '@/components/sections/problem';
import { Steps } from '@/components/sections/steps';
import { Trust } from '@/components/sections/trust';

/**
 * dvote.co is one page, told in order to a shop owner: the promise and a demo they can press, why
 * customers don't come back, how the card works, how you bring them back, what you get, why there's
 * no risk, the price, questions. The footer closes on the rally cry.
 */
export function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <Steps />
      <Comeback />
      <Platform />
      <Trust />
      <Pricing />
      <FaqContact />
    </>
  );
}
