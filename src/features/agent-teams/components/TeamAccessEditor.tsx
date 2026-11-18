import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon, PickerField, type PickerOption } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import type { AssignableUser } from '../agentTeams.types';
import {
  ACCESS_MODE_COPY,
  ACCESS_ROLE_COPY,
  accessProblem,
  addGrant,
  removeGrant,
  setGrantRole,
  type AccessMode,
  type AccessRole,
  type AccessValue,
} from '../teamAccessRules';

interface TeamAccessEditorProps {
  value: AccessValue;
  onChange: (value: AccessValue) => void;
  users: readonly AssignableUser[];
  usersLoading?: boolean;
  usersFailed?: boolean;
  disabled?: boolean;
  /** Show the "pick at least one person" problem (after a failed save). */
  showProblem?: boolean;
}

const MODES: AccessMode[] = ['WORKSPACE', 'PRIVATE', 'SPECIFIC'];
const ROLE_OPTIONS: PickerOption[] = (Object.keys(ACCESS_ROLE_COPY) as AccessRole[]).map((r) => ({
  value: r,
  label: ACCESS_ROLE_COPY[r].label,
  description: ACCESS_ROLE_COPY[r].hint,
}));

const userLabel = (u: AssignableUser | undefined, fallback: string) => (u ? u.name?.trim() || u.email : fallback);

/**
 * Who may reach a team: Company (everyone), Only me, or Specific members, each
 * with their own role. Controlled — the caller owns the value and saves it (the
 * Access screen) or hands it to the install (the Agent Teams marketplace).
 */
export function TeamAccessEditor({ value, onChange, users, usersLoading, usersFailed, disabled, showProblem }: TeamAccessEditorProps) {
  const { theme } = useAppTheme();
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const candidates: PickerOption[] = useMemo(
    () =>
      users
        .filter((u) => !value.access.some((g) => g.userId === u.id))
        .map((u) => ({ value: u.id, label: userLabel(u, u.id), description: u.name ? u.email : undefined })),
    [users, value.access],
  );
  const problem = showProblem ? accessProblem(value) : null;

  return (
    <View style={{ gap: 12 }} pointerEvents={disabled ? 'none' : 'auto'}>
      {MODES.map((mode) => {
        const on = value.mode === mode;
        return (
          <TouchableOpacity
            key={mode}
            onPress={() => onChange({ ...value, mode })}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: Boolean(disabled) }}
            style={[
              styles.mode,
              {
                borderColor: on ? theme.colors.accent : theme.colors.border,
                backgroundColor: on ? theme.colors.accent + '12' : theme.colors.surface,
                borderRadius: theme.radii.lg,
                opacity: disabled ? 0.6 : 1,
              },
            ]}
          >
            <Icon name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={on ? theme.colors.accent : theme.colors.textMuted} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>{ACCESS_MODE_COPY[mode].label}</Text>
              <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs, lineHeight: 17 }}>
                {ACCESS_MODE_COPY[mode].description}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {value.mode === 'SPECIFIC' ? (
        <View style={{ gap: 10 }}>
          {value.access.map((grant) => (
            <View key={grant.userId} style={[styles.grant, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
              <View style={styles.grantTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: theme.colors.text, fontFamily: theme.fontFamilies.body.semibold, fontSize: theme.fontSizes.sm }}>
                    {userLabel(byId.get(grant.userId), 'Former member')}
                  </Text>
                  {byId.get(grant.userId)?.name ? (
                    <Text numberOfLines={1} style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>
                      {byId.get(grant.userId)?.email}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => onChange(removeGrant(value, grant.userId))} accessibilityRole="button" accessibilityLabel="Remove person" hitSlop={10}>
                  <Icon name="close" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <PickerField value={grant.role} options={ROLE_OPTIONS} onChange={(r) => onChange(setGrantRole(value, grant.userId, r as AccessRole))} />
            </View>
          ))}

          <PickerField
            label="Add a person"
            value=""
            options={candidates}
            onChange={(id) => id && onChange(addGrant(value, id))}
            placeholder={usersLoading ? 'Loading people…' : candidates.length === 0 ? 'Everyone is already added' : 'Search by name or email'}
            searchable
            disabled={usersLoading || usersFailed || candidates.length === 0}
            hint={usersFailed ? 'People could not be loaded. Try again later.' : undefined}
          />
          {problem ? <Text style={{ color: theme.colors.error, fontFamily: theme.fontFamilies.body.regular, fontSize: theme.fontSizes.xs }}>{problem}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mode: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1 },
  grant: { borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  grantTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
