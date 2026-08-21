import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const FRAME_WIDTH = 430;
const FRAME_HEIGHT = 932;

const BAR = { left: 24, top: 767, width: 382, height: 109 };
const TRACK_HEIGHT = 27;
const TRACK_INSET = 3;

type LoadingScreenProps = {
  onDone: () => void;
};

export function LoadingScreen({ onDone }: LoadingScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const progress = useSharedValue(0);
  const [percent, setPercent] = useState(0);

  const barLeft = (BAR.left / FRAME_WIDTH) * screenWidth;
  const barTop = (BAR.top / FRAME_HEIGHT) * screenHeight;
  const barWidth = (BAR.width / FRAME_WIDTH) * screenWidth;

  useEffect(() => {
    progress.value = withTiming(100, { duration: 1300 }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [onDone, progress]);

  useAnimatedReaction(
    () => progress.value,
    (value) => runOnJS(setPercent)(Math.round(value))
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/loading-bg.webp')}
        style={styles.background}
        resizeMode="cover"
      />
      <View
        style={[
          styles.loadingContainer,
          {
            left: barLeft,
            top: barTop,
            width: barWidth,
          },
        ]}
      >
        <Text style={styles.label}>Loading ...</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]}>
            <LinearGradient
              colors={['#708B25', '#556E1C', '#3A5012']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradient}
            />
          </Animated.View>
        </View>
        <Text style={styles.label}>{percent}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050b0d',
  },
  background: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    color: '#ffffff',
    fontSize: 24,
    fontStyle: 'italic',
    fontWeight: '500',
    textAlign: 'center',
  },
  track: {
    width: '100%',
    height: TRACK_HEIGHT,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: TRACK_INSET,
  },
  fill: {
    height: TRACK_HEIGHT - TRACK_INSET * 2,
    minWidth: TRACK_HEIGHT - TRACK_INSET * 2,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    ...StyleSheet.absoluteFill,
  },
});
