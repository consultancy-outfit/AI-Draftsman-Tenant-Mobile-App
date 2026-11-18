import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ApprenticeshipDetailScreen } from '@/features/learning/screens/ApprenticeshipDetailScreen';
import { ApprenticeshipsScreen } from '@/features/learning/screens/ApprenticeshipsScreen';
import { CompetencyDetailScreen } from '@/features/learning/screens/CompetencyDetailScreen';
import { LearningWorkspaceScreen } from '@/features/learning/screens/LearningWorkspaceScreen';
import { MyLearningScreen } from '@/features/learning/screens/MyLearningScreen';

import type { LearningStackParamList } from '../types';

const Stack = createNativeStackNavigator<LearningStackParamList>();

/**
 * Apprenticeship Marketplace and My Learning share these screens (Enrol / Resume moves between them), so the
 * two sidebar entries are the same stack with a different first screen.
 */
function LearningStack({ initialRouteName }: { initialRouteName: 'ApprenticeshipsHome' | 'MyLearningHome' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ApprenticeshipsHome" component={ApprenticeshipsScreen} />
      <Stack.Screen name="ApprenticeshipDetail" component={ApprenticeshipDetailScreen} />
      <Stack.Screen name="MyLearningHome" component={MyLearningScreen} />
      <Stack.Screen name="LearningWorkspace" component={LearningWorkspaceScreen} />
      <Stack.Screen name="CompetencyDetail" component={CompetencyDetailScreen} />
    </Stack.Navigator>
  );
}

export const ApprenticeshipsStack = () => <LearningStack initialRouteName="ApprenticeshipsHome" />;
export const MyLearningStack = () => <LearningStack initialRouteName="MyLearningHome" />;
