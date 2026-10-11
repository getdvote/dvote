import { FlexWidget, TextWidget } from 'react-native-android-widget';
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

export function QrWidgetView({ snapshot }: { snapshot: QrSnapshot }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: LINKS.collectQr }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: PURPLE,
        borderRadius: 22,
        padding: 12,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <TextWidget text="▦" style={{ fontSize: 44, color: '#FFFFFF' }} />
      <TextWidget text={snapshot.labels.title} maxLines={1} style={{ fontSize: 15, fontWeight: 'bold', color: '#FFFFFF', marginTop: 4 }} />
      <TextWidget text={snapshot.labels.subtitle} maxLines={2} style={{ fontSize: 12, color: '#E4E1FF', textAlign: 'center' }} />
    </FlexWidget>
  );
}
