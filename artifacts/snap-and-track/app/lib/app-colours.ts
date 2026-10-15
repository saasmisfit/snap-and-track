// Single source of colour for the app and its auth, legal and subscribe
// pages (everything except the landing page, which is themed in globals.css).
// Light theme: white and very faint mint, brand magenta, near-black text.
//
// Keys, and the old per-page COLOURS key each one replaces:
//   pageBg        page background                      (was nearBlack)
//   softBg        soft section / card background, mint
//   card          card surface                         (was card)
//   cardRaised    raised or inset surface, mint        (was cardRaised)
//   border        1px borders                          (was border)
//   heading       headings
//   text          body text                            (was white, used as text)
//   textMuted     secondary text                       (was textMuted, textLight)
//   textFaint     tertiary text                        (was textFaint)
//   onMagenta     text and icons on a magenta fill     (was white, used on buttons)
//   onMagentaFaint  low-emphasis marks on a magenta fill, e.g. a spinner track
//   magenta       brand colour, same as the landing page
//   magentaDark   hover / pressed brand colour, same as the landing page
//   magentaSoft   pale magenta fill                    (was magentaSoft)
//   magentaTint   stronger magenta wash, for outlines  (was magentaTint)
//   success       positive text and icons              (was success, green)
//   successSoft   pale green fill                      (was greenSoft)
//   danger        error text and icons                 (was danger, errorText)
//   dangerSoft    pale red fill                        (was errorBg)
//   dangerBorder  error outline                        (was errorBorder)
//   shadowCard    soft card shadow
//   controlOutline  outline of an empty control or chart mark; 3:1 on white
//   shadowFloat     stronger shadow for floating cards: modals, toasts, menus
//   shadowKnob      small shadow under a switch knob
//   scrim           dimmed backdrop behind a modal
//   magentaPulse / magentaPulseEnd  the animated ring around the voice button
//
// Deliberately dark, for surfaces that sit over a photo or camera view:
//   overlay         full-screen backdrop behind photos
//   onOverlay       text and icons on the overlay
//   onOverlayMuted  captions on the overlay
//   photoMatte      letterbox behind a photo
//
// Nothing on a light background should be lighter than textMuted, so
// textFaint deliberately shares its value. All text colours pass WCAG AA on
// both pageBg and softBg.
export const APP_COLOURS = {
  pageBg: '#FFFFFF',
  softBg: '#F1F8F4',
  card: '#FFFFFF',
  cardRaised: '#F1F8F4',
  border: '#D5E6DC',
  heading: '#14141A',
  text: '#1F1F26',
  textMuted: '#4B4B57',
  textFaint: '#4B4B57',
  onMagenta: '#FFFFFF',
  onMagentaFaint: 'rgba(255,255,255,0.4)',
  magenta: '#B0185E',
  magentaDark: '#8a1249',
  magentaSoft: '#F9EAF1',
  magentaTint: 'rgba(176,24,94,0.25)',
  success: '#15803D',
  successSoft: '#E8F5EC',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  dangerBorder: '#F0B4AE',
  shadowCard: '0 1px 2px rgba(20,20,26,0.04), 0 8px 24px rgba(20,20,26,0.06)',
  controlOutline: '#7C8A82',
  shadowFloat: '0 4px 10px rgba(20,20,26,0.08), 0 18px 44px rgba(20,20,26,0.18)',
  shadowKnob: '0 1px 2px rgba(20,20,26,0.3)',
  scrim: 'rgba(20,20,26,0.6)',
  magentaPulse: 'rgba(176,24,94,0.55)',
  magentaPulseEnd: 'rgba(176,24,94,0)',
  overlay: 'rgba(14,14,16,0.96)',
  onOverlay: '#FFFFFF',
  onOverlayMuted: 'rgba(255,255,255,0.8)',
  photoMatte: '#000000',
} as const;
