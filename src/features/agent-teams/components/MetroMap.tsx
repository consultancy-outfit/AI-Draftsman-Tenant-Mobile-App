import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { TubeModel, TubeStation } from '../agentTeamsRules';
import { layoutMetro, shortLabel, type MetroLayout } from '../metroLayout';

interface MetroMapProps {
  model: TubeModel;
  /** The followed line — every other line fades back. */
  focusLineId: string | null;
  onPressStation: (station: TubeStation) => void;
  onPressLine: (lineId: string) => void;
  /** Canvas height on screen; the drawing pans and zooms inside it. */
  height: number;
  /** 'whole' (default) fits the entire drawing in the box. 'height' fills
   * the box's height at a readable size and lets the user pan sideways —
   * used full screen, where fitting the width left most of the screen empty. */
  fitTo?: 'whole' | 'height';
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;
const clamp = (v: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(Math.max(v, lo), hi);
};

/**
 * The drawn metro map — web's `TeamTubeMap` canvas, for a phone: pinch to
 * zoom, drag to pan, tap a stop for its details, tap a line to follow it.
 * Opens fitted to the canvas height, so the whole shape is visible at once;
 * zoom in to read the stop names.
 */
export function MetroMap({ model, focusLineId, onPressStation, onPressLine, height, fitTo = 'whole' }: MetroMapProps) {
  const { theme } = useAppTheme();
  const layout: MetroLayout = useMemo(() => layoutMetro(model), [model]);
  const [boxW, setBoxW] = useState(0);

  const fit =
    boxW > 0
      ? fitTo === 'height'
        ? clamp(height / layout.height, MIN_SCALE, 1.4)
        : clamp(Math.min(height / layout.height, boxW / layout.width), MIN_SCALE, 1)
      : 0.6;

  const scale = useSharedValue(fit);
  const savedScale = useSharedValue(fit);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const W = useSharedValue(layout.width);
  const H = useSharedValue(layout.height);
  const boxWS = useSharedValue(boxW);
  const boxHS = useSharedValue(height);

  /* Keep the drawing inside the box: it can't be dragged off-screen. */
  const bound = (x: number, y: number, s: number) => {
    'worklet';
    const cw = W.value * s;
    const ch = H.value * s;
    const minX = Math.min(0, boxWS.value - cw);
    const minY = Math.min(0, boxHS.value - ch);
    const maxX = cw < boxWS.value ? (boxWS.value - cw) / 2 : 0;
    const maxY = ch < boxHS.value ? (boxHS.value - ch) / 2 : 0;
    return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
  };

  const reset = (s: number) => {
    W.value = layout.width;
    H.value = layout.height;
    boxWS.value = boxW;
    boxHS.value = height;
    scale.value = withTiming(s);
    savedScale.value = s;
    const b = bound(0, 0, s);
    tx.value = withTiming(b.x);
    ty.value = withTiming(b.y);
    savedTx.value = b.x;
    savedTy.value = b.y;
  };

  useEffect(() => {
    reset(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, layout.width, layout.height, height]);

  const pan = Gesture.Pan()
    .minDistance(6)
    .onUpdate((e) => {
      const b = bound(savedTx.value + e.translationX, savedTy.value + e.translationY, scale.value);
      tx.value = b.x;
      ty.value = b.y;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const s = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE);
      /* Zoom about the pinch point. */
      const k = s / scale.value;
      const b = bound(e.focalX - (e.focalX - tx.value) * k, e.focalY - (e.focalY - ty.value) * k, s);
      scale.value = s;
      tx.value = b.x;
      ty.value = b.y;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      const target = scale.value < 1 ? 1.4 : fit;
      runOnJS(zoomTo)(target, e.x, e.y);
    });

  function zoomTo(target: number, fx: number, fy: number) {
    const k = target / scale.value;
    const b = bound(fx - (fx - tx.value) * k, fy - (fy - ty.value) * k, target);
    scale.value = withTiming(target);
    tx.value = withTiming(b.x);
    ty.value = withTiming(b.y);
    savedScale.value = target;
    savedTx.value = b.x;
    savedTy.value = b.y;
  }

  const zoomBy = (factor: number) => zoomTo(clamp(scale.value * factor, MIN_SCALE, MAX_SCALE), boxW / 2, height / 2);

  const gesture = Gesture.Simultaneous(pan, pinch, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setBoxW(e.nativeEvent.layout.width);

  const ink = theme.colors.text;
  const muted = theme.colors.textMuted;
  const paper = theme.colors.surface;
  const dim = (lineIds: readonly string[]) => (focusLineId && !lineIds.includes(focusLineId) ? 0.18 : 1);

  return (
    <View style={[styles.box, { height, backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ width: layout.width, height: layout.height, transformOrigin: 'top left' }, style]}>
          <Svg width={layout.width} height={layout.height}>
            {/* Stage columns — alternate shading, like web's bands. */}
            {layout.columns.map((c, i) => (
              <G key={c.key}>
                <Rect x={c.x - 84} y={0} width={168} height={layout.height} fill={i % 2 === 0 ? theme.colors.statusNeutralBg : 'transparent'} opacity={0.55} />
                <SvgText x={c.x} y={22} fontSize={12} fontWeight="700" fill={ink} textAnchor="middle">
                  {c.label}
                </SvgText>
                <SvgText x={c.x} y={37} fontSize={9.5} fill={muted} textAnchor="middle">
                  {c.hint}
                </SvgText>
              </G>
            ))}

            {/* Lines — a wide invisible stroke on top makes each one easy to tap. */}
            {layout.lines.map((l) => (
              <G key={l.id} opacity={focusLineId && focusLineId !== l.id ? 0.18 : 1}>
                <Path d={l.d} stroke={l.colour} strokeWidth={focusLineId === l.id ? 5 : 3.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <Path d={l.d} stroke="transparent" strokeWidth={16} fill="none" onPress={() => onPressLine(l.id)} />
              </G>
            ))}

            {/* Stations */}
            {layout.stations.map((p) => {
              const st = p.station;
              const shared = p.count > 1;
              const hub = p.count > 4;
              const dashed = st.dashed;
              const stroke = shared ? ink : (layout.lines.find((l) => l.id === st.lineIds[0])?.colour ?? ink);
              const cy = (p.top + p.bottom) / 2;
              const press = () => onPressStation(st);
              const labelY = p.bottom + (hub ? 26 : shared ? 18 : 16);
              return (
                <G key={st.id} opacity={dim(st.lineIds)}>
                  {hub ? (
                    <G onPress={press}>
                      <Circle cx={p.x} cy={cy} r={Math.max(12, (p.bottom - p.top) / 2 + 7)} fill={paper} stroke={ink} strokeWidth={3} strokeDasharray={dashed ? '4 3' : undefined} />
                      <SvgText x={p.x} y={cy + 4} fontSize={11} fontWeight="700" fill={ink} textAnchor="middle">
                        {p.count}
                      </SvgText>
                    </G>
                  ) : shared ? (
                    <Rect
                      x={p.x - 8}
                      y={p.top - 8}
                      width={16}
                      height={p.bottom - p.top + 16}
                      rx={8}
                      fill={paper}
                      stroke={ink}
                      strokeWidth={3}
                      strokeDasharray={dashed ? '4 3' : undefined}
                      onPress={press}
                    />
                  ) : (
                    <Circle cx={p.x} cy={cy} r={6.5} fill={paper} stroke={stroke} strokeWidth={3} strokeDasharray={dashed ? '3 2.5' : undefined} onPress={press} />
                  )}
                  <SvgText x={p.x} y={labelY} fontSize={10.5} fontWeight="600" fill={ink} textAnchor="middle" onPress={press}>
                    {shortLabel(st.label)}
                  </SvgText>
                  {shared ? (
                    <SvgText x={p.x} y={labelY + 12} fontSize={9} fill={muted} textAnchor="middle">
                      {`shared by ${p.count}`}
                    </SvgText>
                  ) : null}
                  {/* A big invisible target — a 13pt dot is too small for a finger. */}
                  <Circle cx={p.x} cy={cy} r={18} fill="transparent" onPress={press} />
                </G>
              );
            })}
            {/* Divider under the header row. */}
            <Line x1={0} y1={46} x2={layout.width} y2={46} stroke={theme.colors.border} strokeWidth={1} />
          </Svg>
        </Animated.View>
      </GestureDetector>

      {/* Zoom controls */}
      <View style={[styles.controls, { backgroundColor: paper, borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
        <TouchableOpacity onPress={() => zoomBy(1.35)} style={styles.ctrl} accessibilityRole="button" accessibilityLabel="Zoom in">
          <Icon name="add" size={20} color={ink} />
        </TouchableOpacity>
        <View style={[styles.sep, { backgroundColor: theme.colors.border }]} />
        <TouchableOpacity onPress={() => zoomBy(1 / 1.35)} style={styles.ctrl} accessibilityRole="button" accessibilityLabel="Zoom out">
          <Icon name="remove" size={20} color={ink} />
        </TouchableOpacity>
        <View style={[styles.sep, { backgroundColor: theme.colors.border }]} />
        <TouchableOpacity onPress={() => reset(fit)} style={styles.ctrl} accessibilityRole="button" accessibilityLabel="Fit the whole map">
          <Icon name="fit-screen" size={18} color={ink} />
        </TouchableOpacity>
      </View>
      <View style={[styles.hint, { backgroundColor: paper + 'E6', borderRadius: theme.radii.full }]} pointerEvents="none">
        <Text style={{ color: muted, fontSize: 10, fontFamily: theme.fontFamilies.body.medium }}>Pinch to zoom · drag to move · tap a stop</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  controls: { position: 'absolute', right: 10, bottom: 10, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  ctrl: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth },
  hint: { position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 10, paddingVertical: 4 },
});
