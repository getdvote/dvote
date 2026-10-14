import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { LINKS, type PointsSnapshot, type QrSnapshot } from './data';

/**
 * Android home-screen widgets (react-native-android-widget). Names match app.json (plugin
 * "react-native-android-widget"). They are drawn from the snapshot the app saved; tapping opens
 * the app through a deep link.
 */

const PURPLE = '#6155F5';

export function PointsWidgetView({ snapshot }: { snapshot: PointsSnapshot }) {
  const { labels, shops, signedIn } = snapshot;
  const message = !signedIn ? labels.signIn : shops.length === 0 ? labels.empty : null;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: LINKS.cards }}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: '#FFFFFF', borderRadius: 22, padding: 12, flexDirection: 'column' }}
    >
      <TextWidget text={`★ ${labels.title}`} style={{ fontSize: 15, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 6 }} />
      {message ? (
        <TextWidget text={message} maxLines={3} style={{ fontSize: 13, color: '#6E6E73' }} />
      ) : (
        shops.map((s, i) => (
          <FlexWidget
            key={i}
            style={{
              width: 'match_parent',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: s.color as `#${string}`,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
              marginBottom: 5,
            }}
          >
            <TextWidget text={s.name} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: '600', color: s.ink as `#${string}` }} />
            <TextWidget
              text={`${s.points.toLocaleString('en-US')} ${labels.pts}`}
              style={{ fontSize: 14, fontWeight: 'bold', color: s.ink as `#${string}`, marginLeft: 8 }}
            />
          </FlexWidget>
        ))
      )}
      {signedIn ? <TextWidget text={labels.updated} style={{ fontSize: 10, color: '#8E8E93', marginTop: 2 }} /> : null}
    </FlexWidget>
  );
}

/**
 * "Scan me!": a purple gradient tile with a white QR badge framed by scanner corners, a bold
 * call to action and a small "tap · earn points" pill. The QR drawing is decorative: tapping
 * opens the app, which makes the real one-time code.
 */
export function QrWidgetView({ snapshot }: { snapshot: QrSnapshot }) {
  const { title, subtitle, badge } = snapshot.labels;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: LINKS.collectQr }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundGradient: { from: '#7B6CFF', to: '#4A3FD1', orientation: 'TL_BR' },
        borderRadius: 24,
        padding: 12,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <FlexWidget style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 8 }}>
        <SvgWidget svg={QR_SVG} style={{ height: 64, width: 64 }} />
      </FlexWidget>
      <TextWidget text={title} maxLines={1} style={{ fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 }} />
      <TextWidget text={subtitle} maxLines={1} style={{ fontSize: 11, color: '#E4E1FF', marginTop: 1 }} />
      <FlexWidget style={{ backgroundColor: '#FFFFFF33', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 }}>
        <TextWidget text={badge} maxLines={1} style={{ fontSize: 10, fontWeight: 'bold', color: '#FFFFFF' }} />
      </FlexWidget>
    </FlexWidget>
  );
}

/** A QR-style picture (three finder squares + modules) inside purple scanner corners. */
const QR_SVG = (() => {
  const ink = '#1C1C1E';
  const accent = '#6155F5';
  const finder = (x: number, y: number) =>
    `<rect x="${x}" y="${y}" width="16" height="16" rx="3" fill="${ink}"/><rect x="${x + 3}" y="${y + 3}" width="10" height="10" rx="2" fill="#fff"/><rect x="${x + 5.5}" y="${y + 5.5}" width="5" height="5" rx="1" fill="${ink}"/>`;
  // a fixed pattern of modules between the finders (looks like a code, encodes nothing)
  const cells = [
    [26, 10], [32, 10], [26, 16], [38, 16], [32, 22], [10, 30], [16, 30], [26, 30], [38, 30], [44, 30], [50, 30],
    [22, 36], [32, 36], [44, 36], [26, 42], [38, 42], [50, 42], [32, 48], [44, 48], [26, 54], [38, 54], [50, 54], [44, 60],
  ];
  const mods = cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="5" rx="1" fill="${ink}"/>`).join('');
  const corner = (d: string) => `<path d="${d}" fill="none" stroke="${accent}" stroke-width="3.5" stroke-linecap="round"/>`;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68 68">' +
    corner('M2 12 V4 a2 2 0 0 1 2 -2 H12') +
    corner('M56 2 H64 a2 2 0 0 1 2 2 V12') +
    corner('M66 56 V64 a2 2 0 0 1 -2 2 H56') +
    corner('M12 66 H4 a2 2 0 0 1 -2 -2 V56') +
    finder(8, 8) +
    finder(44, 8) +
    finder(8, 44) +
    mods +
    '</svg>'
  );
})();

/** The widgets as elements, for callers in plain .ts files (see index.android.ts). */
export const renderPoints = (snapshot: PointsSnapshot) => <PointsWidgetView snapshot={snapshot} />;
export const renderQr = (snapshot: QrSnapshot) => <QrWidgetView snapshot={snapshot} />;
