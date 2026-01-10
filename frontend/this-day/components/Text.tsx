import { Colors } from "@/theme/colors";
import { Text as RNText, StyleSheet, TextProps } from "react-native";

type Props = TextProps & {
  children: React.ReactNode;
};

export function Title({ children, ...props }: Props) {
  return (
    <RNText {...props} style={[styles.title, props.style]}>
      {children}
    </RNText>
  );
}

export function Body({ children, ...props }: Props) {
  return (
    <RNText {...props} style={[styles.body, props.style]}>
      {children}
    </RNText>
  );
}

export function Muted({ children, ...props }: Props) {
  return (
    <RNText {...props} style={[styles.muted, props.style]}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: Colors.dark.textPrimary,
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.dark.textPrimary,
  },
  muted: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
});
