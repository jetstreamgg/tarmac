import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCookieConsent } from '../context/CookieConsentContext';
import { applyPostHogConsent } from '../PostHogProvider';
import { Text } from '@/modules/layout/components/Typography';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { getFooterLinks } from '@/lib/utils';
import { type ServiceConsent } from '../consentStorage';

export function CookieConsentBanner() {
  const { consent, bannerVisible, bannerView, setBannerView, setConsent } = useCookieConsent();
  const [delayComplete, setDelayComplete] = useState(false);

  // Local toggle state for the manage view
  const [posthogEnabled, setPosthogEnabled] = useState(() => consent?.posthog ?? true);

  // Sync toggle when banner reopens OR consent changes while banner is open
  // (e.g. user changed consent on another subdomain and switched back to this tab)
  const prevVisibleRef = useRef(bannerVisible);
  const prevConsentPosRef = useRef(consent?.posthog);

  const bannerJustOpened = bannerVisible && !prevVisibleRef.current;
  const consentChangedWhileOpen = bannerVisible && consent?.posthog !== prevConsentPosRef.current;

  if (bannerJustOpened || consentChangedWhileOpen) {
    const synced = consent?.posthog ?? true;
    if (synced !== posthogEnabled) {
      setPosthogEnabled(synced);
    }
  }
  prevVisibleRef.current = bannerVisible;
  prevConsentPosRef.current = consent?.posthog;

  useEffect(() => {
    const timer = setTimeout(() => setDelayComplete(true), 3_500);
    return () => clearTimeout(timer);
  }, []);

  const applyConsent = useCallback(
    (newConsent: ServiceConsent) => {
      applyPostHogConsent(newConsent.posthog);
      setConsent(newConsent);
    },
    [setConsent]
  );

  const handleAcceptAll = useCallback(() => applyConsent({ posthog: true }), [applyConsent]);
  const handleSave = useCallback(
    () => applyConsent({ posthog: posthogEnabled }),
    [applyConsent, posthogEnabled]
  );

  const privacyLink = useMemo(() => {
    return getFooterLinks().find(l => /privacy/i.test(l.name));
  }, []);

  const visible = bannerVisible && (consent !== null || delayComplete);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label="Cookie consent"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed right-3 bottom-4 z-[999] max-w-[400px] min-w-[300px] rounded-xl border border-white/10 bg-[#1a1a2e] p-5 md:right-5 lg:right-10"
        >
          <AnimatePresence mode="wait" initial={false}>
            {bannerView === 'default' ? (
              <motion.div
                key="default"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Text variant="captionSm" className="text-white/60">
                  We use analytics cookies to understand how this app is used and to improve it. No personal
                  data is collected.
                  {privacyLink && (
                    <>
                      {' '}
                      For more information, see our{' '}
                      <ExternalLink
                        href={privacyLink.url}
                        skipConfirm
                        showIcon={false}
                        className="underline underline-offset-2"
                      >
                        {privacyLink.name}
                      </ExternalLink>
                      .
                    </>
                  )}
                </Text>
                <Text variant="captionSm" className="mt-3 text-white/60">
                  You can change your preference at any time via Cookie Settings in the footer.
                </Text>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => setBannerView('manage')}
                    className="rounded-lg border border-white/20 px-4 py-2 text-[13px] font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
                  >
                    Manage
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="rounded-lg bg-white/10 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/20"
                  >
                    Accept All
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="manage"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Text variant="captionSm" className="font-medium text-white">
                  Manage cookie preferences
                </Text>
                <Text variant="captionSm" className="mt-2 text-white/40">
                  Choose which analytics services you allow. You can update these at any time.
                </Text>
                <div className="mt-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <Text variant="captionSm" className="font-medium text-white/80">
                        PostHog
                      </Text>
                      <Text variant="captionSm" className="text-white/40">
                        Usage analytics
                      </Text>
                    </div>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={posthogEnabled}
                      onChange={() => setPosthogEnabled(prev => !prev)}
                    />
                    <div className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-white/10 transition-colors peer-checked:bg-[#5116CC] peer-focus-visible:ring-2 peer-focus-visible:ring-white/50 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white/40 after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-white" />
                  </label>
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => setBannerView('default')}
                    className="rounded-lg border border-white/20 px-4 py-2 text-[13px] font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSave}
                    className="rounded-lg bg-white/10 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/20"
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
