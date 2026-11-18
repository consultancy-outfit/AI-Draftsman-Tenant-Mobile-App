import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card, Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { categoryLabel, isImportant, relativeTime } from '../aiLearning.logic';
import type { AiUpdateSummary } from '../aiLearning.types';

interface UpdateCardProps {
  update: AiUpdateSummary;
  now: number;
  onPress: () => void;
}

/** One provider update in the feed: provider, unseen dot, headline, AI summary, category and age. */
function UpdateCardBase({ update, now, onPress }: UpdateCardProps) {
  const { theme } = useAppTheme();
  const important = isImportant(update.importance);
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} accessibilityRole="button" accessibilityLabel={update.title}>
      <Card style={styles.card}>
        <View style={styles.topRow}>
          <View style={[styles.dot, { backgroundColor: update.provider.color || theme.colors.accent }]} />
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}
          >
            {update.provider.name}
          </Text>
          {!update.seen ? (
            <View accessibilityLabel="Unseen" style={[styles.unseen, { backgroundColor: theme.colors.accent }]} />
          ) : null}
          {update.hasShort ? <Icon name="slideshow" size={16} color={theme.colors.textMuted} /> : null}
        </View>

        <Text
          style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.display.semibold, fontSize: theme.fontSizes.md, lineHeight: 22 }}
        >
          {update.title}
        </Text>

        {update.summary ? (
          <Text
            numberOfLines={3}
            style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.sm, lineHeight: 20 }}
          >
            {update.summary}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={[styles.pill, { backgroundColor: theme.colors.statusNeutralBg, borderRadius: theme.radii.full }]}>
            <Text style={{ color: theme.colors.statusNeutralFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
              {categoryLabel(update.category)}
            </Text>
          </View>
          {important ? (
            <View style={[styles.pill, { backgroundColor: theme.colors.statusWarningBg, borderRadius: theme.radii.full }]}>
              <Text style={{ color: theme.colors.statusWarningFg, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.xs }}>
                Important
              </Text>
            </View>
          ) : null}
          <Text style={{ marginLeft: 'auto', color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
            {relativeTime(update.publishedAt, now)}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export const UpdateCard = memo(UpdateCardBase);

const styles = StyleSheet.create({
  card: { gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  unseen: { width: 8, height: 8, borderRadius: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 3 },
});
