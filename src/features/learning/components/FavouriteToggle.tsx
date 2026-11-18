import { TouchableOpacity } from 'react-native';

import { Icon, useToast } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { LEARNING_COPY } from '../learning.data';
import { useSetFavouriteMutation } from '../learningApi';

/** The workspace-favourite heart. Optimistic: it flips at once and rolls back (with a toast) on failure. */
export function FavouriteToggle({ apprenticeshipId, isFavourite }: { apprenticeshipId: string; isFavourite: boolean }) {
  const { theme } = useAppTheme();
  const toast = useToast();
  const [setFavourite] = useSetFavouriteMutation();
  return (
    <TouchableOpacity
      onPress={() => {
        void setFavourite({ apprenticeshipId, isFavourite: !isFavourite })
          .unwrap()
          .catch(() => toast.show(LEARNING_COPY.favouriteFailed, { tone: 'error' }));
      }}
      accessibilityRole="button"
      accessibilityLabel={isFavourite ? LEARNING_COPY.removeFavourite : LEARNING_COPY.addFavourite}
      accessibilityState={{ selected: isFavourite }}
      hitSlop={10}
    >
      <Icon name={isFavourite ? 'favorite' : 'favorite-border'} size={24} color={isFavourite ? theme.colors.accent : theme.colors.textMuted} />
    </TouchableOpacity>
  );
}
