import { checkStorefront } from './storefront';
describe('Feedback placeholders', () => {
  it('keeps old/default feedback sections valid', () => {
    expect(
      checkStorefront({ sections: [{ type: 'feedback' }] }).sections,
    ).toContainEqual({ type: 'feedback' });
  });
  it('requires both languages for custom placeholders and trims them', () => {
    expect(
      checkStorefront({
        sections: [
          { type: 'feedback', placeholder: { en: ' Tell us ', ar: ' رأيك ' } },
        ],
      }).sections,
    ).toContainEqual({
      type: 'feedback',
      placeholder: { en: 'Tell us', ar: 'رأيك' },
    });
    for (const placeholder of [
      null,
      { en: 'Hello' },
      { en: 'Hello', ar: ' ' },
      { en: 'x'.repeat(301), ar: 'رأيك' },
    ]) {
      expect(() =>
        checkStorefront({ sections: [{ type: 'feedback', placeholder }] }),
      ).toThrow();
    }
  });
});
