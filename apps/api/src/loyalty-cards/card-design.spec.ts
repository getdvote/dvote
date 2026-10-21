import { checkDesign, defaultDesign, readDesign, readableInk } from './card-design';

const base = () => defaultDesign('Joy Corner', '#2048AC');

describe('loyalty card design', () => {
  it('defaults: name as title, Points / النقاط, Offers & Rewards, solid, no button 2', () => {
    const d = base();
    expect(d.front.title).toEqual({ en: 'Joy Corner', ar: '' });
    expect(d.front.pointsLabel).toEqual({ en: 'Points', ar: 'النقاط' });
    expect(d.buttons.primaryLabel).toEqual({ en: 'Offers & Rewards', ar: 'العروض والمكافآت' });
    expect(d.background.style).toBe('solid');
    expect(d.buttons.secondary).toEqual({ type: 'none' });
    expect(checkDesign(d)).toEqual(d);
  });

  it('picks white ink on dark and dark ink on light backgrounds', () => {
    expect(readableInk('#2048AC')).toBe('#FFFFFF');
    expect(readableInk('#F7F1E8')).toBe('#1C1C1E');
  });

  it('trims text, cuts it to length and drops unknown keys', () => {
    const d = { ...base(), extra: 1, front: { title: { en: '  Hi  ', ar: 'x'.repeat(60) }, pointsLabel: { en: '', ar: '' } } };
    const out = checkDesign(d);
    expect(out.front.title).toEqual({ en: 'Hi', ar: 'x'.repeat(40) });
    expect(out.front.pointsLabel.en).toBe('Points');
    expect(out).not.toHaveProperty('extra');
  });

  it.each([
    ['bad colour', { colors: { ...base().colors, background: 'blue' } }],
    ['unknown style', { background: { style: 'marble', imageUrl: null, imagePath: null } }],
    ['6 links', { back: { ...base().back, links: Array(6).fill({ platform: 'instagram', value: '@x' }) } }],
    ['unknown platform', { back: { ...base().back, links: [{ platform: 'myspace', value: 'x' }] } }],
    ['custom link without label', { back: { ...base().back, links: [{ platform: 'custom', value: 'https://a.b' }] } }],
    ['directions without branch', { buttons: { ...base().buttons, secondary: { type: 'directions' } } }],
    ['call without phone', { buttons: { ...base().buttons, secondary: { type: 'call', phone: 'abc' } } }],
  ])('rejects %s', (_, patch) => {
    expect(() => checkDesign({ ...base(), ...patch })).toThrow();
  });

  it('accepts 5 links, a call button and one opening time a day', () => {
    const out = checkDesign({
      ...base(),
      buttons: { ...base().buttons, secondary: { type: 'call', phone: '+20 100 123 4567' } },
      back: {
        ...base().back,
        hours: [{ day: 2, opensAt: '17:00', closesAt: '23:00' }, { day: 1, opensAt: '08:00', closesAt: '14:00' }],
        links: [
          ...Array(4).fill({ platform: 'instagram', value: '@joy' }),
          { platform: 'custom', value: 'https://joy.cafe', label: 'Shop' },
        ],
      },
    });
    expect(out.buttons.secondary).toEqual({ type: 'call', phone: '+201001234567' });
    expect(out.back.hours[0].opensAt).toBe('08:00');
    expect(out.back.links).toHaveLength(5);
  });

  it('rejects a second opening time on the same day', () => {
    const hours = [{ day: 2, opensAt: '08:00', closesAt: '12:00' }, { day: 2, opensAt: '14:00', closesAt: '20:00' }];
    expect(() => checkDesign({ ...base(), back: { ...base().back, hours } })).toThrow();
  });

  it('reads a broken stored design as the default in its colour', () => {
    expect(readDesign({ colors: { background: '#112233' } }, 'Shop').colors.background).toBe('#112233');
  });
});
