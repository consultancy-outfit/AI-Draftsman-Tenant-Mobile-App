import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DrawerActions, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppHeader } from '@/components/shell/AppHeader';
import { EmptyState, StatusTabs } from '@/components/ui';
import type { AiLearningStackParamList } from '@/navigation/types';
import { PermissionGate } from '@/permissions';
import { LEARNING_PERMISSIONS } from '@/permissions/slugs';
import { useAppTheme } from '@/theme/ThemeContext';

import { AI_LEARNING_COPY, AI_LEARNING_TABS, type AiLearningTab } from './aiLearning.data';
import { AiCoursesSection } from './sections/AiCoursesSection';
import { AiFeedSection } from './sections/AiFeedSection';
import { MyAiLearningSection } from './sections/MyAiLearningSection';
import { AiShortsSection } from './sections/AiShortsSection';

type Nav = NativeStackNavigationProp<AiLearningStackParamList>;

/**
 * AI Learning home — the four web sections (AI Feed, Shorts, AI Courses, My
 * AI learning) behind one switcher, since the drawer holds a single entry for
 * the module. Gated on `learning.use`, like the sidebar row and the API.
 */
export function AiLearningScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AiLearningStackParamList, 'AiLearningHome'>>();
  const [tab, setTab] = useState<AiLearningTab>(route.params?.tab ?? 'feed');

  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab, route.params?.shortId]);

  const openMenu = () => navigation.dispatch(DrawerActions.openDrawer());
  const openSettings = () => navigation.getParent()?.navigate('MainTabs', { screen: 'SettingsTab' } as never);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={AI_LEARNING_COPY.title} mode="tab" onMenuPress={openMenu} onAvatarPress={openSettings} />
      <PermissionGate
        allOf={[LEARNING_PERMISSIONS.USE]}
        fallback={<EmptyState icon="lock" title="No access" description="Your role does not include AI Learning." />}
      >
        <View style={styles.tabs}>
          <StatusTabs tabs={AI_LEARNING_TABS} value={tab} onChange={(v) => setTab(v as AiLearningTab)} />
        </View>
        {tab === 'feed' ? (
          <AiFeedSection
            onOpenUpdate={(u) => navigation.navigate('AiUpdateDetail', { updateId: u.id, title: u.title })}
          />
        ) : tab === 'shorts' ? (
          <AiShortsSection key={route.params?.shortId ?? 'shorts'} initialShortId={route.params?.shortId} />
        ) : tab === 'courses' ? (
          <AiCoursesSection onOpenCourse={(c) => navigation.navigate('AiCourseDetail', { slug: c.slug, title: c.title })} />
        ) : (
          <MyAiLearningSection
            onOpenCourse={(c) => navigation.navigate('AiCourseDetail', { slug: c.slug, title: c.title })}
            onOpenHistory={(h) => {
              if (h.contentType === 'NEWS') navigation.navigate('AiUpdateDetail', { updateId: h.contentId, ...(h.title ? { title: h.title } : {}) });
              else if (h.contentType === 'LESSON') navigation.navigate('AiLesson', { lessonId: h.contentId, ...(h.title ? { title: h.title } : {}) });
              else if (h.contentType === 'SHORT') navigation.navigate('AiLearningHome', { tab: 'shorts', shortId: h.contentId });
            }}
          />
        )}
      </PermissionGate>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
});
