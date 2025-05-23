import { midnightTheme, Theme } from '@rainbow-me/rainbowkit';

export const rainbowTheme: Theme = {
  ...midnightTheme(),
  radii: { ...midnightTheme().radii, menuButton: '12px', connectButton: '12px' },
  colors: {
    ...midnightTheme().colors,
    connectButtonBackground: 'rgb(97, 67, 246)',
    connectButtonText: 'white',
    modalBackdrop: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#0c0c0dd9',
    modalBorder: 'transparent',
    closeButtonBackground: 'transparent',
    accentColor: 'rgba(102, 72, 246)',
    menuItemBackground: 'rgb(43, 36, 90)',
    profileForeground: '#2E2E2E59'
  },
  blurs: {
    modalOverlay: 'blur(12.5px)'
  },
  fonts: {
    body: 'CircularStd, sans-serif'
  },
  shadows: {
    ...midnightTheme().shadows,
    dialog: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
  }
};
