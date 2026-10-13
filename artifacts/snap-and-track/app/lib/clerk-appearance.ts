import { APP_COLOURS } from './app-colours';

export const clerkAppearance = {
  variables: {
    colorPrimary: APP_COLOURS.magenta,
    colorBackground: APP_COLOURS.card,
    colorInputBackground: APP_COLOURS.card,
    colorText: APP_COLOURS.heading,
    colorTextSecondary: APP_COLOURS.textMuted,
    colorInputText: APP_COLOURS.heading,
    colorTextOnPrimaryBackground: APP_COLOURS.onMagenta,
    colorDanger: APP_COLOURS.danger,
    colorNeutral: APP_COLOURS.heading,
    fontFamily: "'Barlow', sans-serif",
    fontSize: '16px',
    borderRadius: '12px',
  },
  elements: {
    cardBox: {
      border: `1px solid ${APP_COLOURS.border}`,
      boxShadow: APP_COLOURS.shadowCard,
    },
    card: { border: 'none', boxShadow: 'none' },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    socialButtonsBlockButton: {
      backgroundColor: APP_COLOURS.card,
      color: APP_COLOURS.heading,
      border: `1px solid ${APP_COLOURS.border}`,
    },
    socialButtonsBlockButtonText: {
      color: APP_COLOURS.heading,
      fontWeight: '500',
    },
    dividerLine: { backgroundColor: APP_COLOURS.border },
    dividerText: { color: APP_COLOURS.textMuted },
    formFieldLabel: { color: APP_COLOURS.heading },
    formFieldInput: {
      backgroundColor: APP_COLOURS.card,
      color: APP_COLOURS.heading,
      border: `1px solid ${APP_COLOURS.border}`,
      boxShadow: 'none',
    },
    footer: { background: APP_COLOURS.softBg },
    footerActionText: { color: APP_COLOURS.textMuted },
    footerActionLink: { color: APP_COLOURS.magenta, fontWeight: '600' },
  },
};
