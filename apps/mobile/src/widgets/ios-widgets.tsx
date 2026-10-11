import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  lineLimit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { PointsSnapshot, QrSnapshot } from './data';

/**
 * iOS home-screen widgets (WidgetKit through expo-widgets). Their names match app.json
 * (plugin "expo-widgets"). A 'widget' function runs in its own runtime: no imports, hooks or
 * module values inside it, so everything it shows (texts in the app's language, colours, the
 * deep link) comes in its props.
 */

type PointsProps = PointsSnapshot & { link: string };

const DvotePoints = (props: PointsProps, environment: WidgetEnvironment) => {
  'widget';
  const purple = '#6155F5';
  const rows = environment.widgetFamily === 'systemSmall' ? props.shops.slice(0, 2) : props.shops;
  const message = !props.signedIn ? props.labels.signIn : props.shops.length === 0 ? props.labels.empty : null;
  return (
    <VStack alignment="leading" spacing={6} modifiers={[containerBackground('#FFFFFF', 'widget'), widgetURL(props.link)]}>
      <HStack spacing={6}>
        <Image systemName="star.circle.fill" color={purple} size={16} />
        <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle('#1C1C1E')]}>{props.labels.title}</Text>
        <Spacer />
      </HStack>
      {message ? (
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#6E6E73'), lineLimit(3)]}>{message}</Text>
      ) : (
        rows.map((s, i) => (
          <HStack
            key={i}
            spacing={8}
            modifiers={[padding({ horizontal: 10, vertical: 6 }), background(s.color), cornerRadius(10)]}
          >
            <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle(s.ink), lineLimit(1)]}>{s.name}</Text>
            <Spacer minLength={4} />
            <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle(s.ink)]}>
              {s.points.toLocaleString('en-US')} {props.labels.pts}
            </Text>
          </HStack>
        ))
      )}
      <Spacer />
      {props.signedIn ? <Text modifiers={[font({ size: 10 }), foregroundStyle('#8E8E93')]}>{props.labels.updated}</Text> : null}
    </VStack>
  );
};

type QrProps = QrSnapshot & { link: string };

const DvoteQr = (props: QrProps, environment: WidgetEnvironment) => {
  'widget';
  const small = environment.widgetFamily === 'systemSmall';
  return (
    <VStack spacing={8} modifiers={[containerBackground('#6155F5', 'widget'), widgetURL(props.link)]}>
      <Spacer />
      <Image systemName="qrcode" color="#FFFFFF" size={small ? 54 : 64} />
      <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{props.labels.title}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle('#E4E1FF'), lineLimit(2)]}>{props.labels.subtitle}</Text>
      <Spacer />
    </VStack>
  );
};

export const PointsWidget = createWidget('DvotePoints', DvotePoints);
export const QrWidget = createWidget('DvoteQr', DvoteQr);
