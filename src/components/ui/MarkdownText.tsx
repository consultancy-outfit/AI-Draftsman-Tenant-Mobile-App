import { memo, useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Markdown, { type RenderRules } from '@ronradtke/react-native-markdown-display';

import { useAppTheme } from '@/theme/ThemeContext';

interface MarkdownTextProps {
  content: string;
  /** Text colour. Defaults to the theme's body text; pass the on-accent colour inside a coloured bubble. */
  color?: string;
}

/* Only these schemes are opened from a message. An agent's reply is untrusted text, so a
   `javascript:` or `intent:` link in it must never reach `Linking`. */
const SAFE_LINK = /^(https?:|mailto:|tel:)/i;

const rules: RenderRules = {
  /* The library's own fence block (syntax highlighter + horizontal ScrollView + copy icon) is
     replaced by a plain box: it is heavy for chat-sized snippets, and a horizontal ScrollView inside
     a content-sized bubble in an inverted list mis-measures the row's height (so tables are plain
     flex columns too, with wrapping cells, rather than a sideways-scrolling grid). */
  fence: (node, _children, _parent, styles) => (
    <View key={node.key} style={styles.fence}>
      <Text style={styles.fence_token}>{String(node.content).replace(/\n$/, '')}</Text>
    </View>
  ),
};

/**
 * A message's text as markdown (bold, italic, headings, lists, code, links, tables, quotes) rather
 * than one flat string — the same set the desktop app renders in its transcript. Raw HTML in the
 * source is shown as text, never rendered.
 */
function MarkdownTextImpl({ content, color }: MarkdownTextProps) {
  const { theme } = useAppTheme();
  const textColor = color ?? theme.colors.text;

  const style = useMemo(() => {
    const body = theme.fontFamilies.body;
    const bold = { fontFamily: body.bold, fontWeight: 'normal' as const };
    const heading = { ...bold, color: textColor, marginTop: 4, marginBottom: 2 };
    const codeBg = theme.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';
    const rule = theme.colors.border;
    return StyleSheet.create({
      body: { color: textColor, fontFamily: body.regular, fontSize: theme.fontSizes.md, lineHeight: 22 },
      paragraph: { marginTop: 0, marginBottom: 8 },
      strong: bold,
      em: { fontStyle: 'italic' },
      s: { textDecorationLine: 'line-through' },
      heading1: { ...heading, fontSize: 20, lineHeight: 26 },
      heading2: { ...heading, fontSize: 18, lineHeight: 24 },
      heading3: { ...heading, fontSize: 16, lineHeight: 22 },
      heading4: { ...heading, fontSize: 15 },
      heading5: { ...heading, fontSize: 15 },
      heading6: { ...heading, fontSize: 15 },
      bullet_list: { marginBottom: 6 },
      ordered_list: { marginBottom: 6 },
      list_item: { marginBottom: 2 },
      bullet_list_icon: { color: textColor, marginLeft: 4, marginRight: 8 },
      ordered_list_icon: { color: textColor, marginLeft: 4, marginRight: 8 },
      code_inline: {
        fontFamily: theme.fontFamilies.mono.regular,
        fontSize: 13,
        color: textColor,
        backgroundColor: codeBg,
        borderWidth: 0,
        borderRadius: 4,
        paddingHorizontal: 4,
      },
      code_block: {
        fontFamily: theme.fontFamilies.mono.regular,
        fontSize: 13,
        color: textColor,
        backgroundColor: codeBg,
        borderColor: rule,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
      },
      fence_token: { fontFamily: theme.fontFamilies.mono.regular, fontSize: 13, lineHeight: 19, color: textColor },
      fence: {
        fontFamily: theme.fontFamilies.mono.regular,
        fontSize: 13,
        color: textColor,
        backgroundColor: codeBg,
        borderColor: rule,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
      },
      blockquote: {
        backgroundColor: 'transparent',
        borderLeftColor: rule,
        borderLeftWidth: 3,
        marginLeft: 0,
        paddingHorizontal: 10,
        marginBottom: 8,
      },
      hr: { backgroundColor: rule, height: StyleSheet.hairlineWidth, marginVertical: 10 },
      link: { color: theme.colors.accent, textDecorationLine: 'underline' },
      table: { borderWidth: StyleSheet.hairlineWidth, borderColor: rule, borderRadius: 6, marginBottom: 8 },
      thead: { backgroundColor: codeBg },
      th: { flex: 1, padding: 6, fontFamily: body.bold, fontWeight: 'normal' },
      tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: rule, flexDirection: 'row' },
      td: { flex: 1, padding: 6 },
    });
  }, [theme, textColor]);

  return (
    <Markdown
      style={style}
      rules={rules}
      onLinkPress={(url) => {
        if (SAFE_LINK.test(url)) void Linking.openURL(url);
        return false;
      }}
    >
      {content}
    </Markdown>
  );
}

/* Memoised on its props so a long transcript does not re-parse every bubble on each render. */
export const MarkdownText = memo(MarkdownTextImpl);
