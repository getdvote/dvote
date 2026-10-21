import { useLocation } from 'react-router';
import { CardDesignPage } from './card-design-page';
import { CardsPage } from './cards-page';

/** Loyalty → Cards (/card) and its design editor (/card/design), for merchants and the admin workspace. */
export function CardsArea() {
  return useLocation().pathname.replace(/\/$/, '').endsWith('/card/design') ? <CardDesignPage /> : <CardsPage />;
}
