import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { PointsWidgetView, QrWidgetView } from './android-widgets';
import { loadPoints, loadQr } from './data';

/**
 * Runs in the background when Android asks for a widget (added, periodic update, resized).
 * It draws from the snapshot the app last saved: no network, no session needed.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const name = props.widgetInfo.widgetName;
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      if (name === 'DvotePoints') props.renderWidget(<PointsWidgetView snapshot={await loadPoints()} />);
      if (name === 'DvoteQr') props.renderWidget(<QrWidgetView snapshot={await loadQr()} />);
      break;
    default:
      break;
  }
}
