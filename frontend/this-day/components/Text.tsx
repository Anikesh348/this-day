import { useMemo } from "react";
import { useTheme } from "@/theme/ThemeProvider";
import { Text as RNText, StyleSheet, TextProps } from "react-native";

type Props = TextProps & {
  children: React.ReactNode;
};

export function Title({ children, ...props }: Props) {
  const styles = useTextStyles();
  return (
    <RNText {...props} style={[styles.title, props.style]}>
      {children}
    </RNText>
  );
}

export function Body({ children, ...props }: Props) {
  const styles = useTextStyles();
  return (
    <RNText {...props} style={[styles.body, props.style]}>
      {children}
    </RNText>
  );
}

export function Muted({ children, ...props }: Props) {
  const styles = useTextStyles();
  return (
    <RNText {...props} style={[styles.muted, props.style]}>
      {children}
    </RNText>
  );
}

function useTextStyles() {
  const { colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        title: {
          fontSize: 28,
          fontWeight: "600",
          color: colors.textPrimary,
          marginBottom: 12,
        },
        body: {
          fontSize: 16,
          lineHeight: 22,
          color: colors.textPrimary,
        },
        muted: {
          fontSize: 14,
          color: colors.textMuted,
        },
      }),
    [colors],
  );
}
