import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, KeyboardAvoidingView, Platform, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

/** The soft keyboard's current height on iOS (0 when closed), read straight from the keyboard events. */
function useIosKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
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
 *  - Android: keyboard-avoiding padding.
 *  - iOS: pad by the keyboard's real height. `KeyboardAvoidingView` derives it from its own measured
 *    frame, which is wrong inside the native stack / drawer and left the composer behind the keyboard.
 */
export function KeyboardLift({ style, children, ...rest }: ViewProps & { style?: StyleProp<ViewStyle> }) {
  const iosHeight = useIosKeyboardHeight();
  if (Platform.OS === 'ios') {
    return (
      <View {...rest} style={[style, { paddingBottom: iosHeight }]}>
        {children}
      </View>
    );
  }
  return (
    <KeyboardAvoidingView {...rest} style={style} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}
