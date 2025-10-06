import { LinkedActionSteps, StepIndicatorStates, StepMap } from '@/modules/config/context/ConfigContext';
import { Success } from '@/modules/icons';
import { HStack } from '@/modules/layout/components/HStack';
import { Text } from '@/modules/layout/components/Typography';
import React, { JSX, useEffect, useRef } from 'react';

export const ArrowStepIndicator = ({
  step,
  text,
  position,
  stepIcon
}: {
  position: 0 | 1;
  text: string;
  step: LinkedActionSteps;
  stepIcon?: JSX.Element;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(188);
  const { SUCCESS, COMPLETED, FUTURE } = StepIndicatorStates;
  const stepState = StepMap[step][position];
  const arrowBg = `url(images/${['leftArrow', 'rightArrow'][position]}_${stepState}.svg)`;
  const iconColor = stepState === COMPLETED ? 'var(--transparent-white-40)' : 'var(--primary-white)';
  const icon = [SUCCESS, COMPLETED].includes(stepState) ? (
    <Success fill={iconColor} />
  ) : stepIcon ? (
    React.cloneElement(stepIcon, { fill: iconColor })
  ) : null;

  const textColor = [COMPLETED, FUTURE].includes(stepState) ? 'text-selectActive' : 'text-text';
  const textStyle = `${textColor} line-clamp-1`;
  const iconStyle = `${textColor} h-[20px] w-[20px]`;
  const ratio = 188 / 40; // ratio for the bg svg
  const newHeight = Math.max(Math.min(Math.round(width / ratio), 40), 34); // values between 34px and 40px

  useEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) return;

    const updateSize = () => {
      setWidth(containerElement.offsetWidth);
    };
    updateSize();

    // Create observer to watch for changes in card size
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerElement);

    // Cleanup observer on unmount
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={'flex w-full'}
      style={{
        backgroundImage: arrowBg,
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
        height: `${newHeight}px`
      }}
      data-testid="arrow-step-indicator"
    >
      <HStack className={`items-center space-x-2 ${position === 0 ? 'pl-3' : 'pl-6'}`}>
        {icon && <div className={iconStyle}>{icon}</div>}
        <Text variant="small" className={textStyle}>
          {text}
        </Text>
      </HStack>
    </div>
  );
};
