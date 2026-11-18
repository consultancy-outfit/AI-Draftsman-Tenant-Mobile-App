import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AiCourseDetailScreen } from '@/features/aiLearning/AiCourseDetailScreen';
import { AiLearningScreen } from '@/features/aiLearning/AiLearningScreen';
import { AiLessonScreen } from '@/features/aiLearning/AiLessonScreen';
import { AiQuizScreen } from '@/features/aiLearning/AiQuizScreen';
import { AiUpdateDetailScreen } from '@/features/aiLearning/AiUpdateDetailScreen';

import type { AiLearningStackParamList } from '../types';

const Stack = createNativeStackNavigator<AiLearningStackParamList>();

export function AiLearningStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AiLearningHome" component={AiLearningScreen} />
      <Stack.Screen name="AiUpdateDetail" component={AiUpdateDetailScreen} />
      <Stack.Screen name="AiCourseDetail" component={AiCourseDetailScreen} />
      <Stack.Screen name="AiLesson" component={AiLessonScreen} />
      <Stack.Screen name="AiQuiz" component={AiQuizScreen} />
    </Stack.Navigator>
  );
}
