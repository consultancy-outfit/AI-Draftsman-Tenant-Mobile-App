import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dimensions, Keyboard, Platform, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

/** The soft keyboard's current height on iOS (0 when closed), read straight from the keyboard events. */
function useIosKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'android') {
      const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
      const hideSub = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
      return () => {
        show.remove();
        hideSub.remove();
      };
    }
    if (Platform.OS !== 'ios') return undefined;
    const change = Keyboard.addListener('keyboardWillChangeFrame', (e) => {
      const { screenY, height: h } = e.endCoordinates;
      // A frame that starts at/after the bottom edge of the screen means the keyboard is hiding.
      setHeight(screenY >= Dimensions.get('screen').height ? 0 : h);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      change.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * Lifts its content above the soft keyboard. These screens fill the window (and the app is edge-to-edge
 * on Android), so:
 *  - Android: pad by the keyboard's real height (KeyboardAvoidingView left stale padding after hiding).
 *  - iOS: pad by the keyboard's real height. `KeyboardAvoidingView` derives it from its own measured
 *    frame, which is wrong inside the native stack / drawer and left the composer behind the keyboard.
 */
export function KeyboardLift({ style, children, ...rest }: ViewProps & { style?: StyleProp<ViewStyle> }) {
  const iosHeight = useIosKeyboardHeight();
  const { bottom } = useSafeAreaInsets();
  // Android reports the keyboard height without the gesture/nav bar the window extends under.
  const lift = Platform.OS === 'android' && iosHeight > 0 ? iosHeight + bottom : iosHeight;
  return (
    <View {...rest} style={[style, { paddingBottom: lift }]}>
      {children}
    </View>
  );
}
