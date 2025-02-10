import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { easeInOutExpo } from '../animation/timingFunctions';

export const LoadingSpinner = ({ className }: { className?: string }) => {
  return (
    <div className={cn('w-10 mix-blend-overlay', className)}>
      <motion.svg
        viewBox="0 0 1105 1105"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
      >
        <motion.g
          id="Group_1"
          animate={{ rotate: [0, 180, 360, 540, 720] }}
          transition={{ duration: 8, ease: easeInOutExpo, repeat: Infinity }}
        >
          <motion.g
            animate={{ rotate: [0, -22, 0, -22, 0] }}
            transition={{ duration: 8, ease: easeInOutExpo, repeat: Infinity }}
          >
            <rect width="100%" height="100%" />
            <path
              id="S40"
              d="M242.302 794.738C188.528 725.911 159.177 641.152 158.872 553.809L552.435 552.436L242.302 794.738Z"
              fill="white"
              fillOpacity="0.4"
            />
          </motion.g>
          <motion.g
            animate={{ rotate: [0, -18, 0, -18, 0] }}
            transition={{ duration: 8, ease: easeInOutExpo, repeat: Infinity }}
          >
            <rect width="100%" height="100%" />
            <motion.path
              id="S80"
              d="M737.181 204.95C814.3 245.955 875.588 311.449 911.391 391.116L552.413 552.447L737.181 204.95Z"
              fill="white"
              fillOpacity="0.8"
              animate={{ pathLength: [0, 1] }}
              transition={{ duration: 8, ease: easeInOutExpo, repeat: Infinity }}
            />
          </motion.g>
        </motion.g>
        <motion.g
          id="Group_2"
          animate={{ rotate: [0, 360, 720, 1080, 1440] }}
          transition={{ duration: 8, ease: easeInOutExpo, repeat: Infinity }}
        >
          <motion.g
            animate={{ rotate: [0, 28, 0, 28, 0] }}
            transition={{ duration: 8, ease: easeInOutExpo, repeat: Infinity }}
          >
            <rect width="100%" height="100%" />
            <path
              id="S100"
              d="M198.701 379.913C233.285 309.004 288.382 250.126 356.843 210.918C425.304 171.71 503.968 153.982 582.628 160.035L552.434 552.44L198.701 379.913Z"
              fill="white"
            />
          </motion.g>
          <path
            id="S60_1"
            d="M945.945 559.325C944.934 617.249 931.147 674.236 905.569 726.217C879.991 778.199 843.253 823.892 797.977 860.035L552.44 552.456L945.945 559.325Z"
            fill="white"
            fillOpacity="0.6"
          />
          <path
            id="S60_2"
            d="M660.908 930.76C576.949 954.835 487.366 950.297 406.27 917.861L552.427 552.442L660.908 930.76Z"
            fill="white"
            fillOpacity="0.6"
          />
        </motion.g>
      </motion.svg>
    </div>
  );
};
