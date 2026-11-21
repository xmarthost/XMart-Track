import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../state/status';

const TRIGGER = 70;
const HOLD = 56;

const pad = (n) => String(n).padStart(2, '0');
const stamp = (date) =>
  date ? `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}` : '--';

// Pull-down refresh header like common tracking apps:
// "Pull down to refresh" (arrow down) → "Release to refresh" (arrow up) → "Refreshing" (spinner)
// → "Refresh Success" with the last update time.
// children is a function receiving `onScroll` for the scrollable list inside.
export default function PullToRefresh({ onRefresh, children }) {
  const pull = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);
  const [phase, setPhase] = useState('idle'); // idle | pull | release | refreshing | done
  const phaseRef = useRef('idle');
  const [lastUpdate, setLastUpdate] = useState(null);

  const setPhaseBoth = (value) => {
    phaseRef.current = value;
    setPhase(value);
  };

  const finish = () => {
    setLastUpdate(new Date());
    setPhaseBoth('done');
    setTimeout(() => {
      Animated.timing(pull, { toValue: 0, duration: 220, useNativeDriver: false }).start(() => setPhaseBoth('idle'));
    }, 700);
  };

  const startRefresh = async () => {
    setPhaseBoth('refreshing');
    Animated.timing(pull, { toValue: HOLD, duration: 150, useNativeDriver: false }).start();
    try {
      await onRefresh();
    } catch {
      // the list keeps its data; the log has the error
    }
    finish();
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        scrollY.current <= 0 && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) && phaseRef.current === 'idle',
      onPanResponderGrant: () => setPhaseBoth('pull'),
      onPanResponderMove: (_, g) => {
        const distance = Math.max(0, g.dy * 0.5);
        pull.setValue(distance);
        const next = distance >= TRIGGER ? 'release' : 'pull';
        if (next !== phaseRef.current) setPhaseBoth(next);
      },
      onPanResponderRelease: () => {
        if (phaseRef.current === 'release') startRefresh();
        else
          Animated.timing(pull, { toValue: 0, duration: 180, useNativeDriver: false }).start(() =>
            setPhaseBoth('idle'),
          );
      },
      onPanResponderTerminate: () => {
        Animated.timing(pull, { toValue: 0, duration: 180, useNativeDriver: false }).start(() => setPhaseBoth('idle'));
      },
    }),
  ).current;

  const title = {
    pull: 'Pull down to refresh',
    release: 'Release To Refresh',
    refreshing: 'Refreshing',
    done: 'Refresh Success',
  }[phase];

  return (
    <View style={{ flex: 1 }} {...responder.panHandlers}>
      <Animated.View style={[styles.header, { height: pull }]}>
        {phase !== 'idle' && (
          <View style={styles.row}>
            <View style={styles.icon}>
              {phase === 'refreshing' ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : phase === 'done' ? null : (
                <MaterialIcons
                  name={phase === 'release' ? 'arrow-upward' : 'arrow-downward'}
                  size={22}
                  color={colors.muted}
                />
              )}
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{`Last Update ${stamp(lastUpdate)}`}</Text>
            </View>
            <View style={styles.icon} />
          </View>
        )}
      </Animated.View>
      {children((event) => {
        scrollY.current = event.nativeEvent.contentOffset.y;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#EEF2F6' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, height: HOLD },
  icon: { width: 28, alignItems: 'center' },
  title: { fontSize: 15, color: colors.muted, fontWeight: '500' },
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
});
