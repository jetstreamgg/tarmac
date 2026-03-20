import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { t } from '@lingui/core/macro';
import { getBannerById } from '@/data/banners/banners';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { AboutCard } from '@/modules/ui/components/AboutCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { PsmConversionFaq } from './PsmConversionFaq';

export function PsmConversionDetails() {
  const banner = getBannerById('about-11-conversions');
  const contentText = banner?.description ? parseBannerContent(banner.description) : '';

  return (
    <DetailSectionWrapper>
      <DetailSection title={t`About 1:1 Conversions`}>
        <DetailSectionRow>
          <AboutCard
            title={banner?.title}
            icon={
              <span className="flex items-center">
                <TokenIcon token={{ symbol: 'USDS' }} width={24} className="h-6 w-6" showChainIcon={false} />
                <TokenIcon
                  token={{ symbol: 'USDC' }}
                  width={24}
                  className="-ml-2 h-6 w-6"
                  showChainIcon={false}
                />
              </span>
            }
            description={contentText}
            colorMiddle="linear-gradient(43deg, #FFD232 -2.45%, #FF6D6D 100%)"
          />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <PsmConversionFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
